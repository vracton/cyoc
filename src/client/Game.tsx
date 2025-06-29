import React, { useState, useEffect } from 'react';
import { GameScene, ChaosGame } from '../shared/types/game';
import packageJson from '../../package.json';

function extractSubredditName(): string | null {
  const devCommand = packageJson.scripts?.['dev:devvit'];

  if (!devCommand || !devCommand.includes('devvit playtest')) {
    console.warn('"dev:devvit" script is missing or malformed.');
    return null;
  }

  // Match the args after 'devvit playtest'
  const argsMatch = devCommand.match(/devvit\s+playtest\s+(.*)/);
  if (!argsMatch || !argsMatch[1]) {
    console.warn('Could not parse arguments in dev:devvit script.');
    return null;
  }

  const args = argsMatch[1].trim().split(/\s+/);

  // Find the first token that is not a flag (doesn't start with "-" or "--")
  const subreddit = args.find((arg) => !arg.startsWith('-'));

  if (!subreddit) {
    console.warn('No subreddit name found in dev:devvit command.');
    return null;
  }

  return subreddit;
}

const Banner = () => {
  const subreddit = extractSubredditName();
  if (!subreddit) {
    return (
      <div className="w-full bg-red-600 text-white p-4 text-center mb-4">
        Please visit your playtest subreddit to play the game with network functionality.
      </div>
    );
  }

  const subredditUrl = `https://www.reddit.com/r/${subreddit}`;

  return (
    <div className="w-full bg-red-600 text-white p-4 text-center mb-4">
      Please visit{' '}
      <a
        href={subredditUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-bold"
      >
        r/{subreddit}
      </a>{' '}
      to play the game with network functionality. Remember to create a post from the three dots
      (beside the mod tools button).
    </div>
  );
};

const ChaosGamePlay: React.FC<{ gameId: string }> = ({ gameId }) => {
  const [game, setGame] = useState<ChaosGame | null>(null);
  const [currentScene, setCurrentScene] = useState<GameScene | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [makingChoice, setMakingChoice] = useState(false);

  useEffect(() => {
    const loadGame = async () => {
      try {
        console.log('Loading game:', gameId);
        const response = await fetch(`/api/chaos/game/${gameId}`);
        const result = await response.json();
        
        console.log('Game load result:', result);
        
        if (result.status === 'success') {
          setGame(result.game);
          setCurrentScene(result.game.currentScene);
        } else {
          setError(result.message || 'Failed to load game');
        }
      } catch (err) {
        console.error('Error loading game:', err);
        setError('Network error loading game');
      } finally {
        setLoading(false);
      }
    };

    if (gameId) {
      loadGame();
    }
  }, [gameId]);

  const makeChoice = async (choiceId: string) => {
    if (!game || makingChoice) return;

    setMakingChoice(true);
    try {
      console.log('Making choice:', { gameId: game.id, choiceId });
      
      const response = await fetch('/api/chaos/choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, choiceId })
      });

      const result = await response.json();
      console.log('Choice result:', result);
      
      if (result.status === 'success') {
        setCurrentScene(result.scene);
        // Update the game object with new history if needed
        const updatedGame = { ...game };
        updatedGame.currentScene = result.scene;
        setGame(updatedGame);
      } else {
        setError(result.message || 'Failed to make choice');
      }
    } catch (err) {
      console.error('Error making choice:', err);
      setError('Network error making choice');
    } finally {
      setMakingChoice(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400 text-xl">{error}</div>
      </div>
    );
  }

  if (!game || !currentScene) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Game not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">{game.title}</h1>
        <div className="text-gray-400 text-sm mb-4">
          Chaos Level: {game.chaosLevel}/5 | Scene: {currentScene.id}
        </div>
        
        <h2 className="text-xl font-semibold text-blue-400 mb-4">{currentScene.title}</h2>
        <p className="text-gray-300 text-lg leading-relaxed mb-6">{currentScene.description}</p>
        
        {currentScene.isEnding ? (
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400 mb-4">The End</div>
            <div className="text-gray-400">Thank you for playing!</div>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white mb-3">What do you do?</h3>
            {currentScene.choices.map((choice, index) => (
              <button
                key={choice.id}
                onClick={() => makeChoice(choice.id)}
                disabled={makingChoice}
                className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-md transition duration-200 border border-gray-600 hover:border-blue-500"
              >
                <span className="font-semibold text-blue-400">{index + 1}.</span> {choice.text}
                {makingChoice && <span className="ml-2 text-gray-400">(Processing...)</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const Game: React.FC = () => {
  const [gameMode, setGameMode] = useState<'menu' | 'play'>('menu');
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [initialData, setInitialData] = useState<{
    postId: string;
    userId?: string;
    gameId?: string;
  } | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    setShowBanner(!hostname.endsWith('devvit.net'));

    // Listen for messages from Devvit
    const handleMessage = (event: MessageEvent) => {
      console.log('Web view received message:', event.data);
      
      if (event.data?.type === 'initialData') {
        const data = event.data.data;
        setInitialData(data);
        setIsReady(true);
        
        // If there's already a game associated with this post, load it
        if (data.gameId) {
          console.log('Found existing game, switching to play mode:', data.gameId);
          setCurrentGameId(data.gameId);
          setGameMode('play');
          setMessage(`Loading existing game: ${data.gameId}`);
        } else {
          console.log('No existing game found, showing menu');
          setMessage('Ready to create a new chaos story!');
        }
      } else if (event.data?.type === 'gameCreated') {
        const gameId = event.data.data.gameId;
        console.log('Game created, switching to play mode:', gameId);
        setCurrentGameId(gameId);
        setGameMode('play');
        setMessage(`Game created successfully! Game ID: ${gameId}`);
      } else if (event.data?.type === 'error') {
        setMessage(`Error: ${event.data.data.message}`);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Send ready message to Devvit
    console.log('Sending webViewReady message to Devvit');
    window.parent?.postMessage({ type: 'webViewReady' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleCreateStoryClick = () => {
    // Send message to Devvit to show the form
    console.log('Requesting form from Devvit');
    window.parent?.postMessage({ type: 'showCreateForm' }, '*');
  };

  // Show loading state until we receive initial data
  if (!isReady) {
    return (
      <div className="flex flex-col h-full items-center justify-center pt-2 pb-2 box-border">
        {showBanner && <Banner />}
        <div className="max-w-2xl mx-auto p-6 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">Choose Your Own Chaos</h1>
          <p className="text-xl text-gray-300 mb-8">
            Initializing interactive story system...
          </p>
          <div className="text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Play game mode
  if (gameMode === 'play' && currentGameId) {
    return (
      <div className="flex flex-col h-full items-center pt-2 pb-2 box-border">
        {showBanner && <Banner />}
        <ChaosGamePlay gameId={currentGameId} />
        <div className="mt-6">
          <button
            onClick={() => {
              setGameMode('menu');
              setCurrentGameId(null);
            }}
            className="text-blue-400 hover:text-blue-300 underline"
          >
            ← Back to Main Menu
          </button>
        </div>
      </div>
    );
  }

  // Main menu
  return (
    <div className="flex flex-col h-full items-center justify-center pt-2 pb-2 box-border">
      {showBanner && <Banner />}
      <div className="max-w-2xl mx-auto p-6 text-center">
        <h1 className="text-5xl font-bold text-white mb-4">Choose Your Own Chaos</h1>
        <p className="text-xl text-gray-300 mb-8">
          Create and play interactive stories where your choices shape the narrative!
        </p>
        
        <div className="space-y-4">
          <button
            onClick={handleCreateStoryClick}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition duration-200"
          >
            Create New Chaos Story
          </button>
          
          <div className="text-gray-400 text-sm mt-4">
            <p>Click the button above to open the Devvit native form</p>
            <p>The form will appear as a modal overlay from the Devvit system</p>
            {initialData && (
              <div className="mt-2 text-xs">
                <p>Post ID: {initialData.postId}</p>
                {initialData.userId && <p>User ID: {initialData.userId}</p>}
                {initialData.gameId && <p>Game ID: {initialData.gameId}</p>}
              </div>
            )}
          </div>
        </div>
        
        {message && (
          <div className={`mt-6 p-4 rounded-md ${
            message.includes('Error') ? 'bg-red-800' : 'bg-green-800'
          }`}>
            <p className="text-white">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
};