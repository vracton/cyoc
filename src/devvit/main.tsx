import { Devvit, Post, useWebView } from '@devvit/public-api';

// Configure Devvit to enable HTTP requests
Devvit.configure({ http: true });

// Side effect import to bundle the server. The /index is required for server splitting.
import '../server/index';
import { defineConfig } from '@devvit/server';
import { postConfigNew } from '../server/core/post';

defineConfig({
  name: '[Bolt] Choose Your Own Chaos',
  entry: 'index.html',
  height: 'tall',
  menu: { enable: false },
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

// Create the form at the root level for use in web view
const createChaosStoryFormForWebView = Devvit.createForm(formConfig, async (event, context) => {
  const { ui, redis } = context;
  const values = event.values;

  if (!values.title || !values.initialPrompt || !values.chaosLevel) {
    ui.showToast({ text: 'Please fill in all fields!' });
    return;
  }

  try {
    // Import the chaos game creation function directly
    const { createChaosGame } = await import('../server/core/chaos-game');
    
    // Create the chaos game directly via server function
    const result = await createChaosGame({
      title: values.title,
      initialPrompt: values.initialPrompt,
      chaosLevel: parseInt(values.chaosLevel as string)
    }, { redis, userId: context.userId });

    if (result.status === 'error') {
      throw new Error(result.message);
    }

    // Store the game ID in the post config for later retrieval
    if (context.postId) {
      await redis.set(`post_game:${context.postId}`, result.gameId);
    }

    ui.showToast({ text: 'Chaos story created successfully!' });
    
    // The web view will handle the game display automatically
    
  } catch (error) {
    console.error('Error creating chaos story:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    ui.showToast({ text: `Error creating story: ${errorMessage}` });
  }
});

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
          gameId = await redis.get(`post_game:${postId}`);
        }

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
        // Show the pre-created form when requested from web view
        try {
          context.ui.showForm(createChaosStoryFormForWebView);
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
  const { ui, redis, reddit } = context;
  const values = event.values;

  if (!values.title || !values.initialPrompt || !values.chaosLevel) {
    ui.showToast({ text: 'Please fill in all fields!' });
    return;
  }

  let post: Post | undefined;
  try {
    // Import the chaos game creation function directly
    const { createChaosGame } = await import('../server/core/chaos-game');
    
    // Create the chaos game first
    const result = await createChaosGame({
      title: values.title,
      initialPrompt: values.initialPrompt,
      chaosLevel: parseInt(values.chaosLevel as string)
    }, { redis, userId: context.userId });

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
    });

    // Initialize post config and link it to the game
    await postConfigNew({
      redis: context.redis,
      postId: post.id,
    });

    // Store the game ID in the post config
    await redis.set(`post_game:${post.id}`, result.gameId);

    ui.showToast({ text: 'Chaos story and post created successfully!' });
    ui.navigateTo(post.url);
    
  } catch (error) {
    console.error('Error creating chaos story:', error);
    
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
      
      await postConfigNew({
        redis: context.redis,
        postId: post.id,
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