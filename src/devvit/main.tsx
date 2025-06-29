import { Devvit, Post } from '@devvit/public-api';

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
  | { type: 'initialData'; data: { postId: string; userId?: string } }
  | { type: 'gameCreated'; data: { gameId: string } }
  | { type: 'error'; data: { message: string } };

export type WebViewMessage =
  | { type: 'webViewReady' }
  | { type: 'createGame'; data: { title: string; initialPrompt: string; chaosLevel: number } }
  | { type: 'makeChoice'; data: { gameId: string; choiceId: string } };

// Create the form at the root level
const createChaosStoryForm = Devvit.createForm(
  {
    title: 'Create Your Chaos Story',
    description: 'Set up your interactive story for other Redditors to play',
    fields: [
      {
        name: 'title',
        label: 'Story Title',
        type: 'string',
        required: true,
        placeholder: 'Enter a catchy title for your story'
      },
      {
        name: 'initialPrompt',
        label: 'Starting Scenario',
        type: 'paragraph',
        required: true,
        placeholder: 'Describe the initial situation or setting for your story...'
      },
      {
        name: 'chaosLevel',
        label: 'Chaos Level',
        type: 'select',
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
  },
  async (event, context) => {
    const { reddit, ui } = context;
    const values = event.values;

    if (!values.title || !values.initialPrompt || !values.chaosLevel) {
      ui.showToast({ text: 'Please fill in all fields!' });
      return;
    }

    let post: Post | undefined;
    try {
      const subreddit = await reddit.getCurrentSubreddit();
      
      // Create the post first
      post = await reddit.submitPost({
        title: values.title as string,
        subredditName: subreddit.name,
        preview: <Preview text="Creating your chaos story..." />,
      });

      // Initialize post config
      await postConfigNew({
        redis: context.redis,
        postId: post.id,
      });

      ui.showToast({ text: 'Chaos story created successfully!' });
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
  }
);

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
  const { postId, userId } = context;

  const webView = Devvit.useWebView<WebViewMessage, DevvitMessage>({
    url: 'index.html',
    onMessage: async (message, webView) => {
      console.log('Received message from web view:', message);

      if (message.type === 'webViewReady') {
        // Send initial data to web view
        webView.postMessage({
          type: 'initialData',
          data: {
            postId: postId || '',
            userId: userId
          }
        });
      } else if (message.type === 'createGame') {
        try {
          // Handle game creation via server API
          const response = await fetch('/api/chaos/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message.data),
          });

          const result = await response.json();
          
          if (result.status === 'success') {
            webView.postMessage({
              type: 'gameCreated',
              data: { gameId: result.gameId }
            });
          } else {
            webView.postMessage({
              type: 'error',
              data: { message: result.message || 'Failed to create game' }
            });
          }
        } catch (error) {
          console.error('Error creating game:', error);
          webView.postMessage({
            type: 'error',
            data: { message: 'Network error creating game' }
          });
        }
      }
    },
    onUnmount: () => {
      console.log('Web view closed');
    },
  });

  return (
    <vstack width={'100%'} height={'100%'} alignment="center middle" gap="medium" padding="large">
      <text size="xxlarge" weight="bold" color="neutral-content-strong">
        Choose Your Own Chaos
      </text>
      <text size="medium" color="neutral-content" alignment="center">
        Create and play interactive stories where choices shape the narrative!
      </text>
      
      <vstack gap="small" width={'100%'} maxWidth="400px">
        <button 
          appearance="primary" 
          size="large"
          onPress={() => webView.mount()}
        >
          Launch Chaos Game
        </button>
        
        <text size="small" color="neutral-content-weak" alignment="center">
          Click to start your interactive story experience
        </text>
      </vstack>
    </vstack>
  );
};

// Menu action for creating chaos games
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

// Menu action for playing existing chaos games
Devvit.addMenuItem({
  label: '[Bolt Chaos]: New Story Post',
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
        preview: <App />,
      });
      
      await postConfigNew({
        redis: context.redis,
        postId: post.id,
      });
      
      ui.showToast({ text: 'Chaos game post created!' });
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