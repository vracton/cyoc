import { RedisClient } from '@devvit/redis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChaosGame, GameScene, ChaosLevel, StoryHistoryEntry, ChaosVotes, ChaosVoteType, UserChaosProfile } from '../../shared/types/game';

// Server-side functions for chaos game management
const getChaosGameKey = (gameId: string) => `chaos_game:${gameId}` as const;
const getGamesByUserKey = (userId: string) => `user_games:${userId}` as const;
const getUserChaosProfileKey = (userId: string) => `user_chaos_profile:${userId}` as const;
const getChaosLeaderboardKey = () => 'chaos_leaderboard' as const;

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

function calculateChoiceChaosLevel(chaosVotes: ChaosVotes): number {
  const totalVotes = chaosVotes.mild.length + chaosVotes.wild.length + chaosVotes.insane.length;
  if (totalVotes === 0) return 0;
  
  // Weight the votes: mild = 3, wild = 6, insane = 10 (on 0-10 scale)
  const weightedSum = (chaosVotes.mild.length * 3) + (chaosVotes.wild.length * 6) + (chaosVotes.insane.length * 10);
  return Math.round((weightedSum / totalVotes) * 10) / 10; // Round to 1 decimal place
}

function calculateUserGlobalChaosLevel(profile: UserChaosProfile): number {
  const total = profile.chaosContributions.mild + profile.chaosContributions.wild + profile.chaosContributions.insane;
  if (total === 0) return 0;
  
  // Weight the contributions: mild = 3, wild = 6, insane = 10 (on 0-10 scale)
  const weightedSum = (profile.chaosContributions.mild * 3) + (profile.chaosContributions.wild * 6) + (profile.chaosContributions.insane * 10);
  return Math.round((weightedSum / total) * 10) / 10; // Round to 1 decimal place
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
  storyHistory: StoryHistoryEntry[],
  previousScene: GameScene,
  chosenChoice: string,
  chaosLevel: ChaosLevel,
  sceneNumber: number
): Promise<GameScene> {
  const chaosDescription = getChaosLevelDescription(chaosLevel);
  
  const historyText = storyHistory.map((entry, index) => 
    `${index + 1}. ${entry.choiceText} (chosen by ${entry.chosenByUsername || 'unknown user'})`
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
  context: { redis: RedisClient; userId?: string; username?: string }
): Promise<{ status: 'success'; gameId: string } | { status: 'error'; message: string }> {
  try {
    console.log('createChaosGame called with:', data, 'userId:', context.userId, 'username:', context.username);
    
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

    const game: ChaosGame = {
      id: gameId,
      title: data.title,
      initialPrompt: data.initialPrompt,
      chaosLevel: data.chaosLevel,
      createdAt: Date.now(),
      createdBy: context.userId,
      createdByUsername: context.username,
      currentScene: initialScene,
      storyHistory: []
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
    return { status: 'success', game };
  } catch (error) {
    console.error('Error getting game:', error);
    return { status: 'error', message: 'Failed to retrieve game' };
  }
}

export async function makeChaosChoice(
  data: { gameId: string; choiceId: string },
  context: { redis: RedisClient; userId?: string; username?: string }
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

    // Add choice to story history with complete scene information
    const historyEntry: StoryHistoryEntry = {
      sceneId: game.currentScene.id,
      sceneTitle: game.currentScene.title,
      sceneDescription: game.currentScene.description,
      choiceId: data.choiceId,
      choiceText: chosenChoice.text,
      timestamp: Date.now(),
      chosenBy: context.userId,
      chosenByUsername: context.username,
      chaosVotes: { mild: [], wild: [], insane: [] }, // Initialize empty voting
      chaosLevel: 0 // Will be calculated as votes come in
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

    // Update game with new scene
    game.currentScene = newScene;

    // Save updated game
    await context.redis.set(getChaosGameKey(data.gameId), JSON.stringify(game));

    return { status: 'success', scene: newScene, game };
  } catch (error) {
    console.error('Error making choice:', error);
    return { status: 'error', message: 'Failed to process choice' };
  }
}

export async function voteOnHistoryChoice(
  data: { gameId: string; historyIndex: number; voteType: string },
  context: { redis: RedisClient; userId?: string; username?: string }
): Promise<{ status: 'success'; historyEntry: StoryHistoryEntry; userProfile: UserChaosProfile } | { status: 'error'; message: string }> {
  try {
    if (!context.userId) {
      return { status: 'error', message: 'User ID required' };
    }

    const voteType = data.voteType as ChaosVoteType;
    if (!['mild', 'wild', 'insane'].includes(voteType)) {
      return { status: 'error', message: 'Invalid vote type' };
    }

    console.log(`Processing vote: User ${context.userId} voting ${voteType} on history index ${data.historyIndex}`);

    const gameResult = await getChaosGame(data.gameId, context);
    if (gameResult.status === 'error') {
      return gameResult;
    }

    const game = gameResult.game;

    // Find the history entry to vote on
    if (data.historyIndex < 0 || data.historyIndex >= game.storyHistory.length) {
      return { status: 'error', message: 'Invalid history index' };
    }

    const historyEntry = game.storyHistory[data.historyIndex];

    // Initialize chaos votes if not present
    if (!historyEntry.chaosVotes) {
      historyEntry.chaosVotes = { mild: [], wild: [], insane: [] };
    }

    console.log('Before vote removal:', JSON.stringify(historyEntry.chaosVotes));

    // Check if user has already voted and what type
    let previousVoteType: ChaosVoteType | null = null;
    if (historyEntry.chaosVotes.mild.includes(context.userId)) {
      previousVoteType = 'mild';
    } else if (historyEntry.chaosVotes.wild.includes(context.userId)) {
      previousVoteType = 'wild';
    } else if (historyEntry.chaosVotes.insane.includes(context.userId)) {
      previousVoteType = 'insane';
    }

    console.log(`Previous vote type: ${previousVoteType}, New vote type: ${voteType}`);

    // Remove user's previous vote if any
    historyEntry.chaosVotes.mild = historyEntry.chaosVotes.mild.filter(id => id !== context.userId);
    historyEntry.chaosVotes.wild = historyEntry.chaosVotes.wild.filter(id => id !== context.userId);
    historyEntry.chaosVotes.insane = historyEntry.chaosVotes.insane.filter(id => id !== context.userId);

    console.log('After vote removal:', JSON.stringify(historyEntry.chaosVotes));

    // Add new vote
    historyEntry.chaosVotes[voteType].push(context.userId!);

    console.log('After adding new vote:', JSON.stringify(historyEntry.chaosVotes));

    // Recalculate chaos level for the choice
    historyEntry.chaosLevel = calculateChoiceChaosLevel(historyEntry.chaosVotes);

    console.log(`Recalculated chaos level: ${historyEntry.chaosLevel}`);

    // CRITICAL FIX: Update the CHOICE MAKER's profile, not the voter's profile
    const choiceMakerId = historyEntry.chosenBy;
    const choiceMakerUsername = historyEntry.chosenByUsername;
    
    console.log(`Updating chaos profile for choice maker: ${choiceMakerId} (${choiceMakerUsername})`);
    
    // Update the choice maker's chaos profile
    const choiceMakerProfile = await updateUserChaosProfile(
      choiceMakerId, 
      voteType, 
      previousVoteType, 
      { redis: context.redis, username: choiceMakerUsername }
    );

    // Get the voter's profile (for display purposes)
    const voterProfileResult = await getUserChaosProfile(context.userId, context);
    let voterProfile: UserChaosProfile;
    if (voterProfileResult.status === 'success') {
      voterProfile = voterProfileResult.profile;
    } else {
      // Create basic voter profile if it doesn't exist
      voterProfile = {
        userId: context.userId,
        username: context.username,
        totalChaosVotes: 0,
        chaosContributions: { mild: 0, wild: 0, insane: 0 },
        globalChaosLevel: 0,
        lastUpdated: Date.now()
      };
      await context.redis.set(getUserChaosProfileKey(context.userId), JSON.stringify(voterProfile));
    }

    // Save updated game
    await context.redis.set(getChaosGameKey(data.gameId), JSON.stringify(game));

    // Update leaderboard with the choice maker's updated profile
    await updateLeaderboard(choiceMakerProfile, context);

    console.log(`Vote processed successfully. Choice maker ${choiceMakerId} received ${voteType} chaos points.`);

    return { 
      status: 'success', 
      historyEntry, 
      userProfile: voterProfile // Return voter's profile for UI updates
    };
  } catch (error) {
    console.error('Error voting on history choice:', error);
    return { status: 'error', message: 'Failed to process chaos vote' };
  }
}

export async function getUserChaosProfile(
  userId: string,
  context: { redis: RedisClient }
): Promise<{ status: 'success'; profile: UserChaosProfile } | { status: 'error'; message: string }> {
  try {
    const profileData = await context.redis.get(getUserChaosProfileKey(userId));
    
    if (!profileData) {
      // Create new profile
      const newProfile: UserChaosProfile = {
        userId,
        totalChaosVotes: 0,
        chaosContributions: { mild: 0, wild: 0, insane: 0 },
        globalChaosLevel: 0,
        lastUpdated: Date.now()
      };
      
      await context.redis.set(getUserChaosProfileKey(userId), JSON.stringify(newProfile));
      return { status: 'success', profile: newProfile };
    }
    
    const profile = JSON.parse(profileData);
    return { status: 'success', profile };
  } catch (error) {
    console.error('Error getting user chaos profile:', error);
    return { status: 'error', message: 'Failed to retrieve user profile' };
  }
}

export async function getChaosLeaderboard(
  context: { redis: RedisClient }
): Promise<{ status: 'success'; leaderboard: UserChaosProfile[] } | { status: 'error'; message: string }> {
  try {
    const leaderboardData = await context.redis.get(getChaosLeaderboardKey());
    
    if (!leaderboardData) {
      return { status: 'success', leaderboard: [] };
    }
    
    const leaderboard = JSON.parse(leaderboardData);
    return { status: 'success', leaderboard };
  } catch (error) {
    console.error('Error getting chaos leaderboard:', error);
    return { status: 'error', message: 'Failed to retrieve leaderboard' };
  }
}

async function updateUserChaosProfile(
  userId: string,
  newVoteType: ChaosVoteType,
  previousVoteType: ChaosVoteType | null,
  context: { redis: RedisClient; username?: string }
): Promise<UserChaosProfile> {
  const profileResult = await getUserChaosProfile(userId, context);
  
  let profile: UserChaosProfile;
  if (profileResult.status === 'success') {
    profile = profileResult.profile;
  } else {
    // Create new profile if it doesn't exist
    profile = {
      userId,
      username: context.username,
      totalChaosVotes: 0,
      chaosContributions: { mild: 0, wild: 0, insane: 0 },
      globalChaosLevel: 0,
      lastUpdated: Date.now()
    };
  }

  console.log(`Updating choice maker profile. Previous vote received: ${previousVoteType}, New vote received: ${newVoteType}`);
  console.log('Profile before update:', JSON.stringify(profile.chaosContributions));

  // Handle vote changes properly - this represents chaos points the user RECEIVED for their choices
  if (previousVoteType) {
    // Someone changed their vote on this user's choice, so remove the previous chaos points
    profile.chaosContributions[previousVoteType] = Math.max(0, profile.chaosContributions[previousVoteType] - 1);
    // Don't change totalChaosVotes since we're replacing, not adding
  } else {
    // Someone voted on this user's choice for the first time
    profile.totalChaosVotes += 1;
  }

  // Add the new chaos points
  profile.chaosContributions[newVoteType] += 1;

  console.log('Profile after update:', JSON.stringify(profile.chaosContributions));

  // Recalculate global chaos level
  profile.globalChaosLevel = calculateUserGlobalChaosLevel(profile);
  profile.lastUpdated = Date.now();
  
  if (context.username && !profile.username) {
    profile.username = context.username;
  }

  // Save updated profile
  await context.redis.set(getUserChaosProfileKey(userId), JSON.stringify(profile));
  
  console.log(`Choice maker profile updated. New global chaos level: ${profile.globalChaosLevel}`);
  
  return profile;
}

async function updateLeaderboard(
  userProfile: UserChaosProfile,
  context: { redis: RedisClient }
): Promise<void> {
  try {
    const leaderboardResult = await getChaosLeaderboard(context);
    let leaderboard: UserChaosProfile[] = [];
    
    if (leaderboardResult.status === 'success') {
      leaderboard = leaderboardResult.leaderboard;
    }
    
    // Remove existing entry for this user
    leaderboard = leaderboard.filter(profile => profile.userId !== userProfile.userId);
    
    // Add updated profile
    leaderboard.push(userProfile);
    
    // Sort by global chaos level (descending), then by total votes (descending)
    leaderboard.sort((a, b) => {
      if (b.globalChaosLevel !== a.globalChaosLevel) {
        return b.globalChaosLevel - a.globalChaosLevel;
      }
      return b.totalChaosVotes - a.totalChaosVotes;
    });
    
    // Keep only top 100 users
    leaderboard = leaderboard.slice(0, 100);
    
    // Save updated leaderboard
    await context.redis.set(getChaosLeaderboardKey(), JSON.stringify(leaderboard));
  } catch (error) {
    console.error('Error updating leaderboard:', error);
  }
}