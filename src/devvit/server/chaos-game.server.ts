import { RedisClient } from '@devvit/redis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChaosGame, GameScene, ChaosLevel, StoryNode } from '../../shared/types/game';

// Server-side functions for chaos game management
const getChaosGameKey = (gameId: string) => `chaos_game:${gameId}` as const;
const getGamesByUserKey = (userId: string) => `user_games:${userId}` as const;

// Gemini service functions
function getChaosLevelDescription(level: ChaosLevel): string {
  const descriptions = {
    1: 'Mild - Slightly unpredictable with minor twists',
    2: 'Moderate - Some unexpected turns and surprises',
    3: 'Wild - Significant plot twists and chaotic elements',
    4: 'Extreme - Highly unpredictable with major chaos',
    5: 'Maximum Chaos - Completely unpredictable and absurd'
  };
  return descriptions[level];
}

// Story tree management functions
function createInitialStoryTree(initialScene: GameScene): StoryNode {
  return {
    id: 'root',
    sceneId: initialScene.id,
    timestamp: Date.now(),
    children: [],
    isActive: true
  };
}

function updateStoryTree(
  tree: StoryNode, 
  activePathIds: string[], 
  choiceId: string, 
  choiceText: string, 
  newScene: GameScene, 
  userId: string
): { updatedTree: StoryNode; newActivePathIds: string[] } {
  // First, mark all nodes as inactive
  markAllNodesInactive(tree);
  
  // Find the current active leaf node
  const activeLeaf = findNodeByPath(tree, activePathIds);
  
  if (!activeLeaf) {
    throw new Error('Could not find active leaf node');
  }
  
  // Create new node for the choice made
  const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newNode: StoryNode = {
    id: newNodeId,
    sceneId: newScene.id,
    choiceId: choiceId,
    choiceText: choiceText,
    chosenBy: userId,
    timestamp: Date.now(),
    children: [],
    isActive: true
  };
  
  // Add the new node as a child of the current active leaf
  activeLeaf.children.push(newNode);
  
  // Update the active path
  const newActivePathIds = [...activePathIds, newNodeId];
  
  // Mark the new active path
  markActivePath(tree, newActivePathIds);
  
  return {
    updatedTree: tree,
    newActivePathIds: newActivePathIds
  };
}

function markAllNodesInactive(node: StoryNode): void {
  node.isActive = false;
  node.children.forEach(child => markAllNodesInactive(child));
}

function markActivePath(tree: StoryNode, activePathIds: string[]): void {
  // Mark root as active if it's in the path
  if (activePathIds.length === 0 || activePathIds[0] === tree.id || tree.id === 'root') {
    tree.isActive = true;
    
    // If there are more path IDs, find the next node and continue
    if (activePathIds.length > 0) {
      const nextId = activePathIds[0] === 'root' ? activePathIds[1] : activePathIds[0];
      if (nextId) {
        const nextNode = tree.children.find(child => child.id === nextId);
        if (nextNode) {
          const remainingPath = activePathIds[0] === 'root' ? activePathIds.slice(1) : activePathIds;
          markActivePath(nextNode, remainingPath.slice(1));
        }
      }
    }
  }
}

function findNodeByPath(tree: StoryNode, pathIds: string[]): StoryNode | null {
  if (pathIds.length === 0) {
    return tree;
  }
  
  const nextId = pathIds[0];
  if (tree.id === nextId || (tree.id === 'root' && pathIds.length > 0)) {
    const remainingPath = tree.id === 'root' ? pathIds : pathIds.slice(1);
    if (remainingPath.length === 0) {
      return tree;
    }
    
    const nextNodeId = remainingPath[0];
    const nextNode = tree.children.find(child => child.id === nextNodeId);
    if (nextNode) {
      return findNodeByPath(nextNode, remainingPath);
    }
  }
  
  return null;
}

async function generateInitialScene(
  initialPrompt: string,
  chaosLevel: ChaosLevel,
  title: string
): Promise<GameScene> {
  const chaosDescription = getChaosLevelDescription(chaosLevel);
  
  const prompt = `
You are creating the opening scene for a "Choose Your Own Adventure" story called "${title}".

Initial Setup: ${initialPrompt}
Chaos Level: ${chaosLevel}/5 - ${chaosDescription}

Create an engaging opening scene that:
1. Sets up the story based on the initial prompt
2. Incorporates the specified chaos level
3. Ends with exactly 4 meaningful choices for the reader
4. Keeps the description under 200 words
5. Makes each choice lead to distinctly different story paths

Format your response as JSON:
{
  "title": "Scene Title",
  "description": "Scene description that sets up the situation",
  "choices": [
    {"id": "choice1", "text": "Choice 1 description"},
    {"id": "choice2", "text": "Choice 2 description"},
    {"id": "choice3", "text": "Choice 3 description"},
    {"id": "choice4", "text": "Choice 4 description"}
  ]
}

Make sure the JSON is valid and properly formatted.
`;

  try {
    const genAI = new GoogleGenerativeAI("GEMINI_API_KEY");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    console.log('Generating initial scene with prompt:', prompt);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini API response:', text);
    
    // Clean up the response to extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No valid JSON found in Gemini response:', text);
      return createFallbackScene(title, initialPrompt, chaosLevel);
    }
    
    const sceneData = JSON.parse(jsonMatch[0]);
    
    // Validate the scene data
    if (!sceneData.title || !sceneData.description || !sceneData.choices || !Array.isArray(sceneData.choices)) {
      console.error('Invalid scene data structure:', sceneData);
      return createFallbackScene(title, initialPrompt, chaosLevel);
    }

    if (sceneData.choices.length !== 4) {
      console.error('Scene does not have exactly 4 choices:', sceneData.choices);
      return createFallbackScene(title, initialPrompt, chaosLevel);
    }
    
    return {
      id: 'scene_0',
      title: sceneData.title,
      description: sceneData.description,
      choices: sceneData.choices.map((choice: any, index: number) => ({
        id: choice.id || `choice${index + 1}`,
        text: choice.text,
        nextSceneId: `scene_${index + 1}`
      }))
    };
  } catch (error) {
    console.error('Error generating initial scene:', error);
    return createFallbackScene(title, initialPrompt, chaosLevel);
  }
}

function createFallbackScene(title: string, initialPrompt: string, chaosLevel: ChaosLevel): GameScene {
  return {
    id: 'scene_0',
    title: `${title} - The Beginning`,
    description: `${initialPrompt}\n\nYou find yourself at the start of an adventure. The chaos level is set to ${chaosLevel}/5, so expect the unexpected! What will you do first?`,
    choices: [
      {
        id: 'choice1',
        text: 'Look around carefully and assess the situation',
        nextSceneId: 'scene_1'
      },
      {
        id: 'choice2',
        text: 'Take immediate action without hesitation',
        nextSceneId: 'scene_2'
      },
      {
        id: 'choice3',
        text: 'Try to find other people or allies',
        nextSceneId: 'scene_3'
      },
      {
        id: 'choice4',
        text: 'Do something completely unexpected',
        nextSceneId: 'scene_4'
      }
    ]
  };
}

async function generateNextScene(
  storyHistory: Array<{
    sceneId: string;
    choiceId: string;
    choiceText: string;
    timestamp: number;
    chosenBy: string;
  }>,
  previousScene: GameScene,
  chosenChoice: string,
  chaosLevel: ChaosLevel,
  sceneNumber: number
): Promise<GameScene> {
  const chaosDescription = getChaosLevelDescription(chaosLevel);
  
  const historyText = storyHistory.map((entry, index) => 
    `${index + 1}. ${entry.choiceText}`
  ).join('\n');

  const prompt = `
You are continuing a "Choose Your Own Adventure" story.

Previous Story Choices:
${historyText}

Previous Scene: ${previousScene.description}
Chosen Action: ${chosenChoice}
Chaos Level: ${chaosLevel}/5 - ${chaosDescription}
Scene Number: ${sceneNumber}

Continue the story by:
1. Building naturally from the chosen action
2. Incorporating the chaos level appropriately
3. Creating an engaging scene under 200 words
4. Providing exactly 4 new choices
5. Escalating tension and stakes as the story progresses

${sceneNumber > 8 ? 'Consider if this might be a good place to end the story with some choices leading to conclusions.' : ''}

Format your response as JSON:
{
  "title": "Scene Title",
  "description": "Scene description continuing from the chosen action",
  "choices": [
    {"id": "choice1", "text": "Choice 1 description"},
    {"id": "choice2", "text": "Choice 2 description"},
    {"id": "choice3", "text": "Choice 3 description"},
    {"id": "choice4", "text": "Choice 4 description"}
  ]
}

Make sure the JSON is valid and properly formatted.
`;

  try {
    const genAI = new GoogleGenerativeAI("GEMINI_API_KEY");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    console.log('Generating next scene with prompt:', prompt);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini API response for next scene:', text);
    
    // Clean up the response to extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No valid JSON found in next scene response:', text);
      return createFallbackNextScene(chosenChoice, sceneNumber, chaosLevel);
    }
    
    const sceneData = JSON.parse(jsonMatch[0]);
    
    // Validate the scene data
    if (!sceneData.title || !sceneData.description || !sceneData.choices || !Array.isArray(sceneData.choices)) {
      console.error('Invalid next scene data structure:', sceneData);
      return createFallbackNextScene(chosenChoice, sceneNumber, chaosLevel);
    }

    if (sceneData.choices.length !== 4) {
      console.error('Next scene does not have exactly 4 choices:', sceneData.choices);
      return createFallbackNextScene(chosenChoice, sceneNumber, chaosLevel);
    }
    
    return {
      id: `scene_${sceneNumber}`,
      title: sceneData.title,
      description: sceneData.description,
      choices: sceneData.choices.map((choice: any, index: number) => ({
        id: choice.id || `choice${index + 1}`,
        text: choice.text,
        nextSceneId: `scene_${sceneNumber + index + 1}`
      })),
      isEnding: sceneNumber > 10 && Math.random() < 0.3 // 30% chance of ending after scene 10
    };
  } catch (error) {
    console.error('Error generating next scene:', error);
    return createFallbackNextScene(chosenChoice, sceneNumber, chaosLevel);
  }
}

function createFallbackNextScene(chosenChoice: string, sceneNumber: number, chaosLevel: ChaosLevel): GameScene {
  const chaosDescriptions = [
    'Something unexpected happens...',
    'The situation takes a surprising turn...',
    'Chaos ensues as...',
    'In a twist of fate...',
    'The unpredictable nature of this adventure reveals itself as...'
  ];

  const randomDescription = chaosDescriptions[Math.floor(Math.random() * chaosDescriptions.length)];

  return {
    id: `scene_${sceneNumber}`,
    title: `Scene ${sceneNumber}: Unexpected Turn`,
    description: `After choosing to "${chosenChoice}", ${randomDescription} You find yourself in a new situation that requires quick thinking. The chaos level ${chaosLevel}/5 means anything could happen next!`,
    choices: [
      {
        id: 'choice1',
        text: 'Try to adapt to the new circumstances',
        nextSceneId: `scene_${sceneNumber + 1}`
      },
      {
        id: 'choice2',
        text: 'Fight against the unexpected change',
        nextSceneId: `scene_${sceneNumber + 2}`
      },
      {
        id: 'choice3',
        text: 'Embrace the chaos and go with the flow',
        nextSceneId: `scene_${sceneNumber + 3}`
      },
      {
        id: 'choice4',
        text: 'Try to find a creative solution',
        nextSceneId: `scene_${sceneNumber + 4}`
      }
    ],
    isEnding: sceneNumber > 10 && Math.random() < 0.3
  };
}

// Main server-side functions exported for use in Devvit
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

    const gameId = `chaos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('Creating chaos game:', { gameId, ...data, createdBy: context.userId });
    
    // Generate the initial scene using Gemini
    const initialScene = await generateInitialScene(
      data.initialPrompt,
      data.chaosLevel as ChaosLevel,
      data.title
    );

    console.log('Generated initial scene:', initialScene);

    // Create the initial story tree
    const storyTree = createInitialStoryTree(initialScene);

    const game: ChaosGame = {
      id: gameId,
      title: data.title,
      initialPrompt: data.initialPrompt,
      chaosLevel: data.chaosLevel,
      createdAt: Date.now(),
      createdBy: context.userId,
      currentScene: initialScene,
      storyHistory: [],
      storyTree: storyTree,
      activePathIds: ['root']
    };

    // Save the game
    await context.redis.set(getChaosGameKey(gameId), JSON.stringify(game));
    
    // Add to user's games list using JSON array
    const userGamesKey = getGamesByUserKey(context.userId);
    const existingGamesData = await context.redis.get(userGamesKey);
    let userGames: string[] = [];
    
    if (existingGamesData) {
      try {
        userGames = JSON.parse(existingGamesData);
      } catch (error) {
        console.error('Error parsing user games data:', error);
        userGames = [];
      }
    }
    
    // Add the new game ID if it's not already in the list
    if (!userGames.includes(gameId)) {
      userGames.push(gameId);
      await context.redis.set(userGamesKey, JSON.stringify(userGames));
    }

    console.log('Successfully created and saved chaos game:', gameId);
    return { status: 'success', gameId };
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

export async function getChaosGame(
  gameId: string,
  context: { redis: RedisClient }
): Promise<{ status: 'success'; game: ChaosGame } | { status: 'error'; message: string }> {
  try {
    const gameData = await context.redis.get(getChaosGameKey(gameId));
    if (!gameData) {
      console.log('Game not found:', gameId);
      return { status: 'error', message: 'Game not found' };
    }
    
    const game = JSON.parse(gameData);
    
    // Ensure backward compatibility for games without story tree
    if (!game.storyTree) {
      game.storyTree = createInitialStoryTree(game.currentScene);
      game.activePathIds = ['root'];
    }
    
    return { status: 'success', game };
  } catch (error) {
    console.error('Error getting game:', error);
    return { status: 'error', message: 'Failed to retrieve game' };
  }
}

export async function makeChaosChoice(
  data: { gameId: string; choiceId: string },
  context: { redis: RedisClient; userId?: string }
): Promise<{ status: 'success'; scene: GameScene; game: ChaosGame } | { status: 'error'; message: string }> {
  try {
    if (!context.userId) {
      return { status: 'error', message: 'User ID required' };
    }

    const gameResult = await getChaosGame(data.gameId, context);
    if (gameResult.status === 'error') {
      return gameResult;
    }

    const game = gameResult.game;

    // Find the chosen choice
    const chosenChoice = game.currentScene.choices.find(choice => choice.id === data.choiceId);
    if (!chosenChoice) {
      return { status: 'error', message: 'Invalid choice' };
    }

    // Add choice to story history
    const historyEntry = {
      sceneId: game.currentScene.id,
      choiceId: data.choiceId,
      choiceText: chosenChoice.text,
      timestamp: Date.now(),
      chosenBy: context.userId
    };

    game.storyHistory.push(historyEntry);

    // Generate next scene using Gemini
    const sceneNumber = game.storyHistory.length;
    const newScene = await generateNextScene(
      game.storyHistory,
      game.currentScene,
      chosenChoice.text,
      game.chaosLevel,
      sceneNumber
    );

    // Update the story tree
    const { updatedTree, newActivePathIds } = updateStoryTree(
      game.storyTree,
      game.activePathIds,
      data.choiceId,
      chosenChoice.text,
      newScene,
      context.userId
    );

    // Update game with new scene and tree
    game.currentScene = newScene;
    game.storyTree = updatedTree;
    game.activePathIds = newActivePathIds;

    // Save updated game
    await context.redis.set(getChaosGameKey(data.gameId), JSON.stringify(game));

    return { status: 'success', scene: newScene, game };
  } catch (error) {
    console.error('Error making choice:', error);
    return { status: 'error', message: 'Failed to process choice' };
  }
}