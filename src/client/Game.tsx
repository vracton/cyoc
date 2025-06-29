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

// Chaos Game Components
const CreateGameForm: React.FC<{ onGameCreated: (gameId: string) => void }> = ({ onGameCreated }) => {
  const [title, setTitle] = useState('');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [chaosLevel, setChaosLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !initialPrompt.trim()) return;

    setIsCreating(true);
    try {
      // Send message to Devvit to create the game
      window.parent.postMessage({
        type: 'createGame',
        data: { title: title.trim(), initialPrompt: initialPrompt.trim(), chaosLevel }
      }, '*');
    } catch (error) {
      console.error('Error creating game:', error);
      setIsCreating(false);
    }
  };

  // Listen for messages from Devvit
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'devvit-message') {
        const { message } = event.data;
        if (message.type === 'gameCreated') {
          onGameCreated(message.data.gameId);
          setIsCreating(false);
        } else if (message.type === 'error') {
          console.error('Game creation error:', message.data.message);
          setIsCreating(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onGameCreated]);

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold text-white mb-6 text-center">Create Your Chaos Story</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
            Story Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a catchy title for your story"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">
            Starting Scenario
          </label>
          <textarea
            id="prompt"
            value={initialPrompt}
            onChange={(e) => setInitialPrompt(e.target.value)}
            placeholder="Describe the initial situation or setting for your story..."
            rows={4}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="chaos" className="block text-sm font-medium text-gray-300 mb-2">
            Chaos Level: {chaosLevel}
          </label>
          <input
            type="range"
            id="chaos"
            min="1"
            max="5"
            value={chaosLevel}
            onChange={(e) => setChaosLevel(parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5)}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Mild</span>
            <span>Moderate</span>
            <span>Wild</span>
            <span>Extreme</span>
            <span>Maximum</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isCreating || !title.trim() || !initialPrompt.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-md transition duration-200"
        >
          {isCreating ? 'Creating Story...' : 'Create Chaos Story'}
        </button>
      </form>
    </div>
  );
};

const ChaosGamePlay: React.FC<{ gameId: string }> = ({ gameId }) => {
  const [game, setGame] = useState<ChaosGame | null>(null);
  const [currentScene, setCurrentScene] = useState<GameScene | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGame = async () => {
      try {
        const response = await fetch(`/api/chaos/game/${gameId}`);
        const result = await response.json();
        
        if (result.status === 'success') {
          setGame(result.game);
          setCurrentScene(result.game.currentScene);
        } else {
          setError(result.message || 'Failed to load game');
        }
      } catch (err) {
        setError('Network error loading game');
      } finally {
        setLoading(false);
      }
    };

    loadGame();
  }, [gameId]);

  const makeChoice = async (choiceId: string) => {
    if (!game) return;

    setLoading(true);
    try {
      const response = await fetch('/api/chaos/choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, choiceId })
      });

      const result = await response.json();
      
      if (result.status === 'success') {
        setCurrentScene(result.scene);
        // Update game state if needed
      } else {
        setError(result.message || 'Failed to make choice');
      }
    } catch (err) {
      setError('Network error making choice');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading...</div>
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
                disabled={loading}
                className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-md transition duration-200 border border-gray-600 hover:border-blue-500"
              >
                <span className="font-semibold text-blue-400">{index + 1}.</span> {choice.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const Game: React.FC = () => {
  const [gameMode, setGameMode] = useState<'menu' | 'create' | 'play'>('menu');
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [devvitData, setDevvitData] = useState<{ postId?: string; userId?: string }>({});

  useEffect(() => {
    const hostname = window.location.hostname;
    setShowBanner(!hostname.endsWith('devvit.net'));

    // Notify Devvit that web view is ready
    window.parent.postMessage({ type: 'webViewReady' }, '*');

    // Listen for messages from Devvit
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'devvit-message') {
        const { message } = event.data;
        if (message.type === 'initialData') {
          setDevvitData(message.data);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleGameCreated = (gameId: string) => {
    setCurrentGameId(gameId);
    setGameMode('play');
  };

  // Main game mode rendering
  if (gameMode === 'create') {
    return (
      <div className="flex flex-col h-full items-center pt-8 pb-2 box-border">
        {showBanner && <Banner />}
        <CreateGameForm onGameCreated={handleGameCreated} />
      </div>
    );
  }

  if (gameMode === 'play' && currentGameId) {
    return (
      <div className="flex flex-col h-full items-center pt-2 pb-2 box-border">
        {showBanner && <Banner />}
        <ChaosGamePlay gameId={currentGameId} />
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
            onClick={() => setGameMode('create')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition duration-200"
          >
            Create New Chaos Story
          </button>
        </div>
        
        <div className="mt-8 text-gray-400 text-sm">
          {devvitData.postId && <div>Post ID: {devvitData.postId}</div>}
          {devvitData.userId && <div>User ID: {devvitData.userId}</div>}
        </div>
      </div>
    </div>
  );
};