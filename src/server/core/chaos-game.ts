import { RedisClient } from '@devvit/redis';
import { ChaosGame, GameScene, ChaosLevel } from '../../shared/types/game';
import { GeminiService } from './gemini';

const getChaosGameKey = (gameId: string) => `chaos_game:${gameId}` as const;
const getGamesByUserKey = (userId: string) => `user_games:${userId}` as const;

export class ChaosGameService {
  constructor(
    private redis: RedisClient,
    private geminiService: GeminiService
  ) {}

  async createGame(
    title: string,
    initialPrompt: string,
    chaosLevel: ChaosLevel,
    createdBy: string
  ): Promise<ChaosGame> {
    const gameId = `chaos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('Creating chaos game:', { gameId, title, initialPrompt, chaosLevel, createdBy });
    
    try {
      // Generate the initial scene using Gemini
      const initialScene = await this.geminiService.generateInitialScene(
        initialPrompt,
        chaosLevel,
        title
      );

      console.log('Generated initial scene:', initialScene);

      const game: ChaosGame = {
        id: gameId,
        title,
        initialPrompt,
        chaosLevel,
        createdAt: Date.now(),
        createdBy,
        currentScene: initialScene,
        storyHistory: []
      };

      // Save the game
      await this.redis.set(getChaosGameKey(gameId), JSON.stringify(game));
      
      // Add to user's games list
      const userGamesKey = getGamesByUserKey(createdBy);
      await this.redis.sadd(userGamesKey, gameId);

      console.log('Successfully created and saved chaos game:', gameId);
      return game;
    } catch (error) {
      console.error('Error in createGame:', error);
      throw new Error(`Failed to create game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getGame(gameId: string): Promise<ChaosGame | null> {
    try {
      const gameData = await this.redis.get(getChaosGameKey(gameId));
      if (!gameData) {
        console.log('Game not found:', gameId);
        return null;
      }
      
      return JSON.parse(gameData);
    } catch (error) {
      console.error('Error getting game:', error);
      return null;
    }
  }

  async makeChoice(
    gameId: string,
    choiceId: string,
    userId: string
  ): Promise<{ game: ChaosGame; newScene: GameScene }> {
    const game = await this.getGame(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    // Find the chosen choice
    const chosenChoice = game.currentScene.choices.find(choice => choice.id === choiceId);
    if (!chosenChoice) {
      throw new Error('Invalid choice');
    }

    // Add choice to story history
    const historyEntry = {
      sceneId: game.currentScene.id,
      choiceId,
      choiceText: chosenChoice.text,
      timestamp: Date.now(),
      chosenBy: userId
    };

    game.storyHistory.push(historyEntry);

    try {
      // Generate next scene using Gemini
      const sceneNumber = game.storyHistory.length;
      const newScene = await this.geminiService.generateNextScene(
        game.storyHistory,
        game.currentScene,
        chosenChoice.text,
        game.chaosLevel,
        sceneNumber
      );

      // Update game with new scene
      game.currentScene = newScene;

      // Save updated game
      await this.redis.set(getChaosGameKey(gameId), JSON.stringify(game));

      return { game, newScene };
    } catch (error) {
      console.error('Error making choice:', error);
      throw new Error(`Failed to generate next scene: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserGames(userId: string): Promise<string[]> {
    const userGamesKey = getGamesByUserKey(userId);
    return await this.redis.smembers(userGamesKey);
  }

  async deleteGame(gameId: string, userId: string): Promise<boolean> {
    const game = await this.getGame(gameId);
    if (!game || game.createdBy !== userId) {
      return false;
    }

    // Remove from Redis
    await this.redis.del(getChaosGameKey(gameId));
    
    // Remove from user's games list
    const userGamesKey = getGamesByUserKey(userId);
    await this.redis.srem(userGamesKey, gameId);

    return true;
  }
}

// Export a standalone function for direct use in Devvit context
export async function createChaosGame(
  data: { title: string; initialPrompt: string; chaosLevel: number },
  context: { redis: RedisClient; userId?: string }
): Promise<{ status: 'success'; gameId: string } | { status: 'error'; message: string }> {
  try {
    console.log('createChaosGame called with:', data, 'userId:', context.userId);
    
    if (!context.userId) {
      return { status: 'error', message: 'User ID required' };
    }

    // Validate input
    if (!data.title || !data.initialPrompt || !data.chaosLevel) {
      return { status: 'error', message: 'Title, initial prompt, and chaos level are required' };
    }

    if (data.chaosLevel < 1 || data.chaosLevel > 5) {
      return { status: 'error', message: 'Chaos level must be between 1 and 5' };
    }

    // Initialize services
    const geminiApiKey = "AIzaSyCEkDS-IGaotnNq2koQMipzEMr5XIwbASg";
    
    if (!geminiApiKey) {
      console.error('Gemini API key not available');
      return { status: 'error', message: 'AI service not configured' };
    }

    console.log('Initializing Gemini service...');
    const geminiService = new GeminiService(geminiApiKey);
    const chaosGameService = new ChaosGameService(context.redis, geminiService);

    console.log('Creating game via service...');
    // Create the game
    const game = await chaosGameService.createGame(
      data.title,
      data.initialPrompt,
      data.chaosLevel as ChaosLevel,
      context.userId
    );

    console.log('Game created successfully:', game.id);
    return { status: 'success', gameId: game.id };
  } catch (error) {
    console.error('Error in createChaosGame:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create game';
    console.error('Full error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    return { 
      status: 'error', 
      message: errorMessage
    };
  }
}