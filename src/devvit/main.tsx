import { Devvit, Post, useWebView } from '@devvit/public-api';
import { createChaosGame, getChaosGame, makeChaosChoice } from './server/chaos-game.js';

// Configure Devvit to enable HTTP requests
Devvit.configure({ 
  http: true,
  redis: true,
  userActions: true,
});

// Message types for communication between Devvit and web view
export type DevvitMessage =
  | { type: 'initialData'; data: { postId: string; userId?: string; gameId?: string } }
  | { type: 'gameCreated'; data: { gameId: string } }
  | { type: 'error'; data: { message: string } };

export type WebViewMessage =
  | { type: 'webViewReady' }
  | { type: 'showCreateForm' }
  | { type: 'makeChoice'; data: { gameId: string; choiceId: string } };

// Extract form configuration for reuse
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

export const Preview: Devvit.BlockComponent<{ text?: string }> = ({ text = 'Loading...' }) => {
  return (
    <zstack width={'100%'} height={'100%'} alignment="center middle">
      <vstack width={'100%'} height={'100%'} alignment="center middle">
        <image
          url="loading.gif"
          description="Loading..."
          height={'140px'}
          width={'140px'}
          imageHeight={'240px'}
          imageWidth={'240px'}
        />
        <spacer size="small" />
        <text maxWidth={`80%`} size="large" weight="bold" alignment="center middle" wrap>
          {text}
        </text>
      </vstack>
    </zstack>
  );
};

// Main App Component with Web View
const App: Devvit.BlockComponent = (context) => {
  const { postId, userId, redis } = context;

  const webView = useWebView<WebViewMessage, DevvitMessage>({
    url: 'index.html',
    onMessage: async (message, webView) => {
      console.log('Received message from web view:', message);

      if (message.type === 'webViewReady') {
        // Check if there's already a game associated with this post
        let gameId = null;
        if (postId) {
          try {
            gameId = await redis.get(`post_game:${postId}`);
            console.log('Found existing game for post:', postId, 'gameId:', gameId);
          } catch (error) {
            console.error('Error checking for existing game:', error);
          }
        }

        console.log('Sending initial data to web view:', { postId, userId, gameId });

        // Send initial data to web view
        webView.postMessage({
          type: 'initialData',
          data: {
            postId: postId || '',
            userId: userId,
            gameId: gameId || undefined
          }
        });
      } else if (message.type === 'showCreateForm') {
        // Create a form specifically for this web view context
        const createFormForWebView = Devvit.createForm(formConfig, async (event, formContext) => {
          const { ui, redis: formRedis } = formContext;
          const values = event.values;

          if (!values.title || !values.initialPrompt || !values.chaosLevel) {
            ui.showToast({ text: 'Please fill in all fields!' });
            return;
          }

          try {
            console.log('Creating game with values:', values);
            
            // Create the chaos game using server-side function
            const result = await createChaosGame({
              title: values.title as string,
              initialPrompt: values.initialPrompt as string,
              chaosLevel: parseInt(values.chaosLevel as string)
            }, { redis: formRedis, userId });

            console.log('Game creation result:', result);

            if (result.status === 'error') {
              throw new Error(result.message);
            }

            // Store the game ID in the post config for later retrieval
            if (postId) {
              await formRedis.set(`post_game:${postId}`, result.gameId);
              console.log('Stored game ID in post config:', postId, result.gameId);
            }

            ui.showToast({ text: 'Chaos story created successfully!' });
            
            // Notify the web view that a game was created
            webView.postMessage({
              type: 'gameCreated',
              data: { gameId: result.gameId }
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

  return webView;
};

// Create the form at the root level for menu actions
const createChaosStoryForm = Devvit.createForm(formConfig, async (event, context) => {
  const { ui, redis, reddit, userId } = context;
  const values = event.values;

  if (!values.title || !values.initialPrompt || !values.chaosLevel) {
    ui.showToast({ text: 'Please fill in all fields!' });
    return;
  }

  let post: Post | undefined;
  try {
    console.log('Creating game via menu action with values:', values);
    
    // Create the chaos game using server-side function
    const result = await createChaosGame({
      title: values.title as string,
      initialPrompt: values.initialPrompt as string,
      chaosLevel: parseInt(values.chaosLevel as string)
    }, { redis, userId });

    console.log('Menu action game creation result:', result);

    if (result.status === 'error') {
      throw new Error(result.message);
    }

    // Now create a Reddit post for this game
    const subreddit = await reddit.getCurrentSubreddit();
    post = await reddit.submitPost({
      title: values.title as string,
      subredditName: subreddit.name,
      preview: <Preview text="Choose Your Own Chaos - Interactive Story" />,
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

    // Show the registered form
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

    let post: Post | undefined;
    try {
      const subreddit = await reddit.getCurrentSubreddit();
      post = await reddit.submitPost({
        title: 'Choose Your Own Chaos - Interactive Stories',
        subredditName: subreddit.name,
        preview: <Preview text="Choose Your Own Chaos - Interactive Stories" />,
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

// Add custom post type
Devvit.addCustomPostType({
  name: 'Chaos Game',
  height: 'tall',
  render: App,
});

export default Devvit;