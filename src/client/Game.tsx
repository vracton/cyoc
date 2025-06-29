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

// Create Game Form Component - Direct form display
const CreateGameForm: React.FC<{ onSubmit: (data: any) => void; onCancel: () => void }> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    initialPrompt: '',
    chaosLevel: '1'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.initialPrompt || !formData.chaosLevel) {
      alert('Please fill in all fields!');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: formData.title,
        initialPrompt: formData.initialPrompt,
        chaosLevel: parseInt(formData.chaosLevel)
      });
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold text-white mb-6 text-center">Create Your Chaos Story</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
            Story Title *
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter a catchy title for your story"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label htmlFor="initialPrompt" className="block text-sm font-medium text-gray-300 mb-2">
            Starting Scenario *
          </label>
          <textarea
            id="initialPrompt"
            value={formData.initialPrompt}
            onChange={(e) => setFormData({ ...formData, initialPrompt: e.target.value })}
            placeholder="Describe the initial situation or setting for your story..."
            rows={4}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            required
          />
        </div>

        <div>
          <label htmlFor="chaosLevel" className="block text-sm font-medium text-gray-300 mb-2">
            Chaos Level *
          </label>
          <select
            id="chaosLevel"
            value={formData.chaosLevel}
            onChange={(e) => setFormData({ ...formData, chaosLevel: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="1">1 - Mild (Slightly unpredictable)</option>
            <option value="2">2 - Moderate (Some surprises)</option>
            <option value="3">3 - Wild (Significant twists)</option>
            <option value="4">4 - Extreme (Highly unpredictable)</option>
            <option value="5">5 - Maximum Chaos (Completely absurd)</option>
          </select>
        </div>

        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`flex-1 font-bold py-3 px-6 rounded-md transition duration-200 ${
              isSubmitting 
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isSubmitting ? 'Creating Story...' : 'Create Story'}
          </button>
          
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-md transition duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
      
      <div className="text-sm text-gray-400 mt-6">
        <div className="p-3 bg-blue-900 rounded-md">
          <p className="text-blue-200 text-xs">
            <strong>How it works:</strong> Fill out the form above to create your interactive chaos story. 
            The AI will generate an engaging opening scene with choices for players to make!
          </p>
        </div>
      </div>
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
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const hostname = window.location.hostname;
    setShowBanner(!hostname.endsWith('devvit.net'));
  }, []);

  const handleFormSubmit = async (formData: any) => {
    try {
      const response = await fetch('/api/chaos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      
      if (result.status === 'success') {
        setMessage(`Game created successfully! Game ID: ${result.gameId}`);
        setCurrentGameId(result.gameId);
        setGameMode('play');
      } else {
        setMessage(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error creating game:', error);
      setMessage('Network error creating game');
    }
  };

  const handleFormCancel = () => {
    setGameMode('menu');
    setMessage('');
  };

  // Create game form mode
  if (gameMode === 'create') {
    return (
      <div className="flex flex-col h-full items-center pt-8 pb-2 box-border">
        {showBanner && <Banner />}
        <CreateGameForm onSubmit={handleFormSubmit} onCancel={handleFormCancel} />
        {message && (
          <div className={`mt-4 p-4 rounded-md max-w-2xl ${
            message.includes('Error') ? 'bg-red-800' : 'bg-green-800'
          }`}>
            <p className="text-white">{message}</p>
          </div>
        )}
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
            onClick={() => setGameMode('menu')}
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
            onClick={() => setGameMode('create')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition duration-200"
          >
            Create New Chaos Story
          </button>
          
          <div className="text-gray-400 text-sm mt-4">
            <p>Click the button above to immediately open the story creation form</p>
            <p>No additional requests needed - the form displays directly</p>
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