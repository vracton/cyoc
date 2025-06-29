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
    
    // Generate the initial scene using Gemini
    const initialScene = await this.geminiService.generateInitialScene(
      initialPrompt,
      chaosLevel,
      title
    );

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

    return game;
  }

  async getGame(gameId: string): Promise<ChaosGame | null> {
    const gameData = await this.redis.get(getChaosGameKey(gameId));
    if (!gameData) return null;
    
    return JSON.parse(gameData);
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