import { Devvit, useWebView, useState } from '@devvit/public-api';
import { createChaosGame, getChaosGame, makeChaosChoice, voteOnHistoryChoice, getUserChaosProfile, getChaosLeaderboard } from './server/chaos-game.server.js';

// Configure Devvit to enable required features
Devvit.configure({ 
  http: true,
  redis: true,
  redditAPI: true,
  userActions: true
});

// Message types for communication between Devvit and web view
export type DevvitMessage =
  | { type: 'initialData'; data: { postId: string; userId?: string; username?: string; gameId?: string; game?: any; userProfile?: any } }
  | { type: 'gameCreated'; data: { gameId: string; game: any } }
  | { type: 'gameData'; data: { status: 'success'; game: any } | { status: 'error'; message: string } }
  | { type: 'choiceResult'; data: { status: 'success'; scene: any; game: any } | { status: 'error'; message: string } }
  | { type: 'chaosVoteResult'; data: { status: 'success'; historyEntry: any; userProfile: any } | { status: 'error'; message: string } }
  | { type: 'leaderboardData'; data: { status: 'success'; leaderboard: any[] } | { status: 'error'; message: string } }
  | { type: 'error'; data: { message: string } };

export type WebViewMessage =
  | { type: 'webViewReady' }
  | { type: 'showCreateForm' }
  | { type: 'getGame'; data: { gameId: string } }
  | { type: 'makeChoice'; data: { gameId: string; choiceId: string } }
  | { type: 'voteHistoryChaos'; data: { gameId: string; historyIndex: number; voteType: string } }
  | { type: 'getLeaderboard' };

// Form configuration for creating chaos stories
const formConfig = {
  title: 'Create Your Chaos Story',
  description: 'Set up your interactive story for other Redditors to play',
  fields: [
    {
      name: 'title',
      label: 'Story Title',
      type: 'string' as const,
      required: true,
      placeholder: 'Enter a catchy title for your story'
    },
    {
      name: 'initialPrompt',
      label: 'Starting Scenario',
      type: 'paragraph' as const,
      required: true,
      placeholder: 'Describe the initial situation or setting for your story...'
    },
    {
      name: 'chaosLevel',
      label: 'Chaos Level',
      type: 'select' as const,
      required: true,
      options: [
        { label: '1 - Mild (Slightly unpredictable)', value: '1' },
        { label: '2 - Moderate (Some surprises)', value: '2' },
        { label: '3 - Wild (Significant twists)', value: '3' },
        { label: '4 - Extreme (Highly unpredictable)', value: '4' },
        { label: '5 - Maximum Chaos (Completely absurd)', value: '5' }
      ]
    }
  ],
  acceptLabel: 'Create Story',
  cancelLabel: 'Cancel'
};

// Enhanced Preview component that shows story content with neon styling
export const Preview: Devvit.BlockComponent<{ postId?: string }> = (props, context) => {
  const { postId, redis } = context;
  
  if (!postId) {
    // No post ID - show generic preview with neon styling
    return (
      <zstack width={'100%'} height={'100%'} alignment="center middle">
        <image 
          url="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cfilter id='neon'%3E%3CfeGaussianBlur stdDeviation='3' result='coloredBlur'/%3E%3CfeMerge%3E%3CfeMergeNode in='coloredBlur'/%3E%3CfeMergeNode in='SourceGraphic'/%3E%3C/feMerge%3E%3C/filter%3E%3C/defs%3E%3Crect width='100' height='100' fill='%23000' opacity='0.9'/%3E%3Ctext x='50' y='30' text-anchor='middle' fill='%2300FFFF' font-family='monospace' font-size='8' filter='url(%23neon)'%3ECHAOS%3C/text%3E%3Ctext x='50' y='50' text-anchor='middle' fill='%23FF00FF' font-family='monospace' font-size='12' filter='url(%23neon)'%3E🎲%3C/text%3E%3Ctext x='50' y='70' text-anchor='middle' fill='%2300FFFF' font-family='monospace' font-size='8' filter='url(%23neon)'%3EPROTOCOL%3C/text%3E%3C/svg%3E"
          imageHeight={100}
          imageWidth={100}
          height="100px"
          width="100px"
        />
        <vstack width={'100%'} height={'100%'} alignment="center middle" gap="medium" padding="large">
          <text size="xxlarge" weight="bold" alignment="center middle" wrap color="#00FFFF">
            🎲 CHOOSE YOUR OWN CHAOS
          </text>
          <text size="medium" color="#FF00FF" alignment="center middle" wrap>
            Interactive storytelling awaits
          </text>
          <text size="small" color="#FFFF00" alignment="center middle" wrap>
            Click to create or play stories
          </text>
        </vstack>
      </zstack>
    );
  }
  
  // Use useState for async operations
  const [gameData] = useState(async () => {
    try {
      // Get game ID from post
      const gameId = await redis.get(`post_game:${postId}`);
      if (!gameId) {
        return null;
      }
      
      // Get game data
      const gameResult = await getChaosGame(gameId, { redis });
      if (gameResult.status !== 'success') {
        return null;
      }
      
      return gameResult.game;
    } catch (error) {
      console.error('Error in Preview component:', error);
      return null;
    }
  });

  if (!gameData) {
    // No game data or loading - show generic preview with neon styling
    return (
      <zstack width={'100%'} height={'100%'} alignment="center middle">
        <image 
          url="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cfilter id='neon'%3E%3CfeGaussianBlur stdDeviation='3' result='coloredBlur'/%3E%3CfeMerge%3E%3CfeMergeNode in='coloredBlur'/%3E%3CfeMergeNode in='SourceGraphic'/%3E%3C/feMerge%3E%3C/filter%3E%3C/defs%3E%3Crect width='100' height='100' fill='%23000' opacity='0.9'/%3E%3Ctext x='50' y='30' text-anchor='middle' fill='%2300FFFF' font-family='monospace' font-size='8' filter='url(%23neon)'%3ECHAOS%3C/text%3E%3Ctext x='50' y='50' text-anchor='middle' fill='%23FF00FF' font-family='monospace' font-size='12' filter='url(%23neon)'%3E🎲%3C/text%3E%3Ctext x='50' y='70' text-anchor='middle' fill='%2300FFFF' font-family='monospace' font-size='8' filter='url(%23neon)'%3EPROTOCOL%3C/text%3E%3C/svg%3E"
          imageHeight={100}
          imageWidth={100}
          height="100px"
          width="100px"
        />
        <vstack width={'100%'} height={'100%'} alignment="center middle" gap="medium" padding="large">
          <text size="xxlarge" weight="bold" alignment="center middle" wrap color="#00FFFF">
            🎲 CHOOSE YOUR OWN CHAOS
          </text>
          <text size="medium" color="#FF00FF" alignment="center middle" wrap>
            Interactive storytelling awaits
          </text>
          <text size="small" color="#FFFF00" alignment="center middle" wrap>
            Click to create or play stories
          </text>
        </vstack>
      </zstack>
    );
  }
  
  const scene = gameData.currentScene;
  const isEnding = scene.isEnding;
  const storyProgress = gameData.storyHistory.length;
  
  return (
    <zstack width={'100%'} height={'100%'} alignment="top start">
      {/* Dark background with neon border effect */}
      <image 
        url="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Cdefs%3E%3Cfilter id='neon'%3E%3CfeGaussianBlur stdDeviation='2' result='coloredBlur'/%3E%3CfeMerge%3E%3CfeMergeNode in='coloredBlur'/%3E%3CfeMergeNode in='SourceGraphic'/%3E%3C/feMerge%3E%3C/filter%3E%3C/defs%3E%3Crect width='400' height='300' fill='%23000' stroke='%2300FFFF' stroke-width='2' filter='url(%23neon)' opacity='0.9'/%3E%3C/svg%3E"
        imageHeight={300}
        imageWidth={400}
        height="100%"
        width="100%"
        resizeMode="cover"
      />
      <vstack width={'100%'} height={'100%'} gap="small" padding="medium">
        {/* Header */}
        <hstack width={'100%'} alignment="space-between middle">
          <text size="large" weight="bold" color="#00FFFF" wrap>
            {gameData.title}
          </text>
          <text size="small" color="#FF00FF">
            Scene {storyProgress + 1}
          </text>
        </hstack>
        
        {/* Story Status */}
        <hstack width={'100%'} gap="small" alignment="start middle">
          <text size="small" color="#FFFF00">
            Chaos Level {gameData.chaosLevel}/5
          </text>
          <text size="small" color="#666666">
            •
          </text>
          <text size="small" color="#FFFF00">
            {storyProgress} choices made
          </text>
          {isEnding && (
            <>
              <text size="small" color="#666666">•</text>
              <text size="small" color="#FF0080">ENDING</text>
            </>
          )}
        </hstack>
        
        {/* Current Scene */}
        <vstack width={'100%'} gap="small">
          <text size="medium" weight="bold" color="#00FFFF" wrap>
            {scene.title}
          </text>
          <text size="small" color="#CCCCCC" wrap>
            {scene.description.length > 150 
              ? scene.description.substring(0, 150) + '...' 
              : scene.description}
          </text>
        </vstack>
        
        {/* Choices Preview */}
        {!isEnding && scene.choices && scene.choices.length > 0 && (
          <vstack width={'100%'} gap="small">
            <text size="small" weight="bold" color="#FF00FF">
              What happens next?
            </text>
            <vstack width={'100%'} gap="small">
              {scene.choices.slice(0, 2).map((choice: any, index: number) => (
                <hstack key={choice.id} width={'100%'} gap="small" alignment="start middle">
                  <text size="small" color="#FFFF00" weight="bold">
                    [{index + 1}]
                  </text>
                  <text size="small" color="#CCCCCC" wrap>
                    {choice.text.length > 60 
                      ? choice.text.substring(0, 60) + '...' 
                      : choice.text}
                  </text>
                </hstack>
              ))}
              {scene.choices.length > 2 && (
                <text size="small" color="#666666" style="italic">
                  +{scene.choices.length - 2} more choices...
                </text>
              )}
            </vstack>
          </vstack>
        )}
        
        {/* Ending Message */}
        {isEnding && (
          <vstack width={'100%'} gap="small" alignment="center middle">
            <text size="medium" weight="bold" color="#FF0080">
              🎭 Story Complete!
            </text>
            <text size="small" color="#CCCCCC" alignment="center middle">
              This adventure has reached its conclusion
            </text>
          </vstack>
        )}
        
        {/* Call to Action */}
        <spacer size="small" />
        <hstack width={'100%'} alignment="center middle">
          <text size="small" color="#00FFFF" weight="bold">
            {isEnding ? 'View Full Story' : 'Continue the Chaos'} →
          </text>
        </hstack>
      </vstack>
    </zstack>
  );
};

// Main App Component with Web View - Updated with neon styling
const App: Devvit.BlockComponent = (context) => {
  const { postId, userId, reddit, redis } = context;

  const { mount } = useWebView<WebViewMessage, DevvitMessage>({
    url: 'index.html',
    onMessage: async (message, webView) => {
      console.log('Received message from web view:', message);

      if (message.type === 'webViewReady') {
        // Get current user info
        let username = undefined;
        try {
          if (userId) {
            const user = await reddit.getUserById(userId);
            username = user.username;
          }
        } catch (error) {
          console.error('Error getting username:', error);
        }

        // Get user's chaos profile
        let userProfile = null;
        if (userId) {
          try {
            const profileResult = await getUserChaosProfile(userId, { redis });
            if (profileResult.status === 'success') {
              userProfile = profileResult.profile;
            }
          } catch (error) {
            console.error('Error getting user chaos profile:', error);
          }
        }

        // Check if there's already a game associated with this post
        let gameId = null;
        let gameData = null;
        
        if (postId) {
          try {
            gameId = await redis.get(`post_game:${postId}`);
            console.log('Found existing game for post:', postId, 'gameId:', gameId);
            
            // If we have a gameId, fetch the complete game data
            if (gameId) {
              const gameResult = await getChaosGame(gameId, { redis });
              if (gameResult.status === 'success') {
                gameData = gameResult.game;
                console.log('Successfully loaded game data:', gameData.title);
              } else {
                console.error('Failed to load game data:', gameResult.message);
              }
            }
          } catch (error) {
            console.error('Error checking for existing game:', error);
          }
        }

        console.log('Sending initial data to web view:', { postId, userId, username, gameId, hasGameData: !!gameData, hasUserProfile: !!userProfile });

        // Send initial data to web view, including complete game data if available
        webView.postMessage({
          type: 'initialData',
          data: {
            postId: postId || '',
            userId: userId,
            username: username,
            gameId: gameId,
            game: gameData, // Send the complete game data
            userProfile: userProfile // Send user's chaos profile
          }
        });
      } else if (message.type === 'getGame') {
        // Handle game data request - this should now be redundant since we send it in initialData
        try {
          const result = await getChaosGame(message.data.gameId, { redis });
          console.log('Sending game data to webview:', result);
          webView.postMessage({
            type: 'gameData',
            data: result
          });
        } catch (error) {
          console.error('Error getting game:', error);
          webView.postMessage({
            type: 'gameData',
            data: { status: 'error', message: 'Failed to load game' }
          });
        }
      } else if (message.type === 'makeChoice') {
        // Handle choice making
        try {
          console.log('Processing choice:', message.data);
          
          // Get current user info for the choice
          let username = undefined;
          try {
            if (userId) {
              const user = await reddit.getUserById(userId);
              username = user.username;
            }
          } catch (error) {
            console.error('Error getting username for choice:', error);
          }

          const result = await makeChaosChoice(message.data, { redis, userId, username, reddit });
          console.log('Choice result:', result);
          
          webView.postMessage({
            type: 'choiceResult',
            data: result
          });
        } catch (error) {
          console.error('Error making choice:', error);
          webView.postMessage({
            type: 'choiceResult',
            data: { status: 'error', message: 'Failed to process choice' }
          });
        }
      } else if (message.type === 'voteHistoryChaos') {
        // Handle chaos voting on history entries
        try {
          console.log('Processing history chaos vote:', message.data);
          
          // Get current user info for the vote
          let username = undefined;
          try {
            if (userId) {
              const user = await reddit.getUserById(userId);
              username = user.username;
            }
          } catch (error) {
            console.error('Error getting username for vote:', error);
          }

          const result = await voteOnHistoryChoice(message.data, { redis, userId, username, reddit });
          console.log('History chaos vote result:', result);
          
          webView.postMessage({
            type: 'chaosVoteResult',
            data: result
          });
        } catch (error) {
          console.error('Error processing history chaos vote:', error);
          webView.postMessage({
            type: 'chaosVoteResult',
            data: { status: 'error', message: 'Failed to process chaos vote' }
          });
        }
      } else if (message.type === 'getLeaderboard') {
        // Handle leaderboard request
        try {
          console.log('Processing leaderboard request');
          
          const result = await getChaosLeaderboard({ redis });
          console.log('Leaderboard result:', result);
          
          webView.postMessage({
            type: 'leaderboardData',
            data: result
          });
        } catch (error) {
          console.error('Error getting leaderboard:', error);
          webView.postMessage({
            type: 'leaderboardData',
            data: { status: 'error', message: 'Failed to load leaderboard' }
          });
        }
      } else if (message.type === 'showCreateForm') {
        // Create a form specifically for this web view context
        const createFormForWebView = Devvit.createForm(formConfig, async (event, formContext) => {
          const { ui, redis: formRedis, reddit: formReddit } = formContext;
          const values = event.values;

          if (!values.title || !values.initialPrompt || !values.chaosLevel) {
            ui.showToast({ text: 'Please fill in all fields!' });
            return;
          }

          try {
            console.log('Creating game with values:', values);
            
            // Get current user info
            let username = undefined;
            try {
              if (userId) {
                const user = await formReddit.getUserById(userId);
                username = user.username;
              }
            } catch (error) {
              console.error('Error getting username for game creation:', error);
            }
            
            // Create the chaos game using server-side function
            const result = await createChaosGame({
              title: values.title as string,
              initialPrompt: values.initialPrompt as string,
              chaosLevel: parseInt(values.chaosLevel as string)
            }, { redis: formRedis, userId, username, reddit: formReddit });

            console.log('Game creation result:', result);

            if (result.status === 'error') {
              throw new Error(result.message);
            }

            // Store the game ID in the post config for later retrieval
            if (postId) {
              await formRedis.set(`post_game:${postId}`, result.gameId);
              console.log('Stored game ID in post config:', postId, result.gameId);
            }

            // Get the complete game data to send to webview
            const gameResult = await getChaosGame(result.gameId, { redis: formRedis });
            let gameData = null;
            if (gameResult.status === 'success') {
              gameData = gameResult.game;
            }

            ui.showToast({ text: 'Chaos story created successfully!' });
            
            // Notify the web view that a game was created with complete game data
            webView.postMessage({
              type: 'gameCreated',
              data: { 
                gameId: result.gameId,
                game: gameData
              }
            });
            
          } catch (error) {
            console.error('Error creating chaos story:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            ui.showToast({ text: `Error creating story: ${errorMessage}` });
            
            // Notify web view of error
            webView.postMessage({
              type: 'error',
              data: { message: errorMessage }
            });
          }
        });

        // Show the form
        try {
          context.ui.showForm(createFormForWebView);
        } catch (error) {
          console.error('Error showing form:', error);
          webView.postMessage({
            type: 'error',
            data: { message: 'Unable to show form' }
          });
        }
      }
    },
    onUnmount: () => {
      console.log('Web view closed');
    },
  });

  // Use useState for async operations to load game data for preview
  const [gameData] = useState(async () => {
    if (!postId) {
      return null;
    }
    
    try {
      const gameId = await redis.get(`post_game:${postId}`);
      if (!gameId) {
        return null;
      }
      
      const gameResult = await getChaosGame(gameId, { redis });
      if (gameResult.status === 'success') {
        return gameResult.game;
      }
    } catch (error) {
      console.error('Error loading game for preview:', error);
    }
    
    return null;
  });

  if (gameData) {
    // Show story preview with current scene and choices - with neon styling
    const scene = gameData.currentScene;
    const isEnding = scene.isEnding;
    const storyProgress = gameData.storyHistory.length;
    
    return (
      <zstack width={'100%'} height={'100%'} alignment="center middle">
        {/* Dark background with neon border effect */}
        <image 
          url="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='600' viewBox='0 0 400 600'%3E%3Cdefs%3E%3Cfilter id='neon'%3E%3CfeGaussianBlur stdDeviation='3' result='coloredBlur'/%3E%3CfeMerge%3E%3CfeMergeNode in='coloredBlur'/%3E%3CfeMergeNode in='SourceGraphic'/%3E%3C/feMerge%3E%3C/filter%3E%3C/defs%3E%3Crect width='400' height='600' fill='%23000' stroke='%2300FFFF' stroke-width='3' filter='url(%23neon)' opacity='0.95'/%3E%3C/svg%3E"
          imageHeight={600}
          imageWidth={400}
          height="100%"
          width="100%"
          resizeMode="cover"
        />
        <vstack width={'100%'} height={'100%'} alignment="center middle" gap="medium" padding="large">
          {/* Header */}
          <hstack width={'100%'} alignment="space-between middle">
            <text size="large" weight="bold" color="#00FFFF" wrap>
              🎲 {gameData.title}
            </text>
            <text size="small" color="#FF00FF">
              Scene {storyProgress + 1}
            </text>
          </hstack>
          
          {/* Story Status */}
          <hstack width={'100%'} gap="small" alignment="center middle">
            <text size="small" color="#FFFF00">
              Chaos Level {gameData.chaosLevel}/5
            </text>
            <text size="small" color="#666666">
              •
            </text>
            <text size="small" color="#FFFF00">
              {storyProgress} choices made
            </text>
            {isEnding && (
              <>
                <text size="small" color="#666666">•</text>
                <text size="small" color="#FF0080">ENDING</text>
              </>
            )}
          </hstack>
          
          {/* Current Scene */}
          <vstack width={'100%'} gap="small" alignment="center middle">
            <text size="medium" weight="bold" color="#00FFFF" wrap alignment="center middle">
              {scene.title}
            </text>
            <text size="small" color="#CCCCCC" wrap alignment="center middle">
              {scene.description.length > 200 
                ? scene.description.substring(0, 200) + '...' 
                : scene.description}
            </text>
          </vstack>
          
          {/* Choices Preview */}
          {!isEnding && scene.choices && scene.choices.length > 0 && (
            <vstack width={'100%'} gap="small" alignment="center middle">
              <text size="small" weight="bold" color="#FF00FF" alignment="center middle">
                What happens next?
              </text>
              <vstack width={'100%'} gap="small" alignment="center middle">
                {scene.choices.map((choice: any, index: number) => (
                  <hstack key={choice.id} width={'100%'} gap="small" alignment="start middle">
                    <text size="small" color="#FFFF00" weight="bold">
                      [{index + 1}]
                    </text>
                    <text size="small" color="#CCCCCC" wrap>
                      {choice.text.length > 80 
                        ? choice.text.substring(0, 80) + '...' 
                        : choice.text}
                    </text>
                  </hstack>
                ))}
              </vstack>
            </vstack>
          )}
          
          {/* Ending Message */}
          {isEnding && (
            <vstack width={'100%'} gap="small" alignment="center middle">
              <text size="medium" weight="bold" color="#FF0080" alignment="center middle">
                🎭 Story Complete!
              </text>
              <text size="small" color="#CCCCCC" alignment="center middle">
                This adventure has reached its conclusion
              </text>
            </vstack>
          )}
          
          {/* Enter Button */}
          <button appearance="primary" onPress={mount}>
            {isEnding ? 'View Full Story' : 'Continue the Adventure'}
          </button>
        </vstack>
      </zstack>
    );
  } else {
    // No game data - show default interface with neon styling
    return (
      <zstack width={'100%'} height={'100%'} alignment="center middle">
        {/* Dark background with neon border effect */}
        <image 
          url="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Cdefs%3E%3Cfilter id='neon'%3E%3CfeGaussianBlur stdDeviation='3' result='coloredBlur'/%3E%3CfeMerge%3E%3CfeMergeNode in='coloredBlur'/%3E%3CfeMergeNode in='SourceGraphic'/%3E%3C/feMerge%3E%3C/filter%3E%3C/defs%3E%3Crect width='400' height='400' fill='%23000' stroke='%23FF00FF' stroke-width='3' filter='url(%23neon)' opacity='0.95'/%3E%3C/svg%3E"
          imageHeight={400}
          imageWidth={400}
          height="100%"
          width="100%"
          resizeMode="cover"
        />
        <vstack width={'100%'} height={'100%'} alignment="center middle" gap="medium">
          <text size="xxlarge" weight="bold" alignment="center middle" color="#FF00FF">
            Choose Your Own Chaos
          </text>
          <text size="medium" color="#00FFFF" alignment="center middle" wrap>
            Let the chaos begin!
          </text>
          <button appearance="primary" onPress={mount}>
            Enter
          </button>
        </vstack>
      </zstack>
    );
  }
};

// Create the form at the root level for menu actions
const createChaosStoryForm = Devvit.createForm(formConfig, async (event, context) => {
  const { ui, redis, reddit, userId } = context;
  const values = event.values;

  if (!values.title || !values.initialPrompt || !values.chaosLevel) {
    ui.showToast({ text: 'Please fill in all fields!' });
    return;
  }

  let post: any;
  try {
    console.log('Creating game via menu action with values:', values);
    
    // Get current user info
    let username = undefined;
    try {
      if (userId) {
        const user = await reddit.getUserById(userId);
        username = user.username;
      }
    } catch (error) {
      console.error('Error getting username for menu action:', error);
    }
    
    // Create the chaos game using server-side function
    const result = await createChaosGame({
      title: values.title as string,
      initialPrompt: values.initialPrompt as string,
      chaosLevel: parseInt(values.chaosLevel as string)
    }, { redis, userId, username, reddit });

    console.log('Menu action game creation result:', result);

    if (result.status === 'error') {
      throw new Error(result.message);
    }

    // Now create a Reddit post for this game
    const subreddit = await reddit.getCurrentSubreddit();
    post = await reddit.submitPost({
      title: values.title as string,
      subredditName: subreddit.name,
      preview: <Preview postId={''} />, // We'll update this after we get the post ID
      runAs: 'USER',
      userGeneratedContent: { text: values.title as string }
    });

    // Store the game ID in the post config
    await redis.set(`post_game:${post.id}`, result.gameId);
    console.log('Menu action: Stored game ID in post config:', post.id, result.gameId);

    ui.showToast({ text: 'Chaos story and post created successfully!' });
    ui.navigateTo(post.url);
    
  } catch (error) {
    console.error('Error creating chaos story via menu:', error);
    
    // Clean up the post if it was created
    if (post) {
      try {
        await post.remove(false);
      } catch (cleanupError) {
        console.error('Error cleaning up post:', cleanupError);
      }
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    ui.showToast({ text: `Error creating story: ${errorMessage}` });
  }
});

// Menu action for creating chaos games - this creates both the game AND the post
Devvit.addMenuItem({
  label: '[Bolt Chaos]: Create Story',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const { ui } = context;
    ui.showForm(createChaosStoryForm);
  },
});

// Menu action for creating empty posts (for testing)
Devvit.addMenuItem({
  label: '[Bolt Chaos]: New Empty Post',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const { reddit, ui } = context;

    let post: any;
    try {
      const subreddit = await reddit.getCurrentSubreddit();
      post = await reddit.submitPost({
        title: 'Choose Your Own Chaos - Interactive Stories',
        subredditName: subreddit.name,
        preview: <Preview />,
      });
      
      ui.showToast({ text: 'Empty chaos game post created!' });
      ui.navigateTo(post.url);
    } catch (error) {
      if (post) {
        await post.remove(false);
      }
      if (error instanceof Error) {
        ui.showToast({ text: `Error creating post: ${error.message}` });
      } else {
        ui.showToast({ text: 'Error creating post!' });
      }
    }
  },
});

// Add custom post type - this renders the interactive content
Devvit.addCustomPostType({
  name: 'Chaos Game',
  height: 'tall',
  render: App,
});

export default Devvit;