import React, { useState, useEffect } from 'react';
import { GameScene, GameState, InitResponse, MakeChoiceResponse } from '../shared/types/game';

export const Game: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentScene, setCurrentScene] = useState<GameScene | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = async () => {
    try {
      const response = await fetch('/api/init');
      const result = (await response.json()) as InitResponse;
      
      if (result.status === 'error') {
        setError(result.message);
        return;
      }
      
      setGameState(result.gameState);
      await loadCurrentScene(result.gameState.currentSceneId);
    } catch (err) {
      setError('Failed to initialize game');
      console.error('Game initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentScene = async (sceneId: string) => {
    try {
      const response = await fetch(`/api/scene/${sceneId}`);
      const result = await response.json();
      
      if (result.status === 'error') {
        setError(result.message);
        return;
      }
      
      setCurrentScene(result.scene);
    } catch (err) {
      setError('Failed to load scene');
      console.error('Scene loading error:', err);
    }
  };

  const makeChoice = async (choiceId: string) => {
    if (!gameState || !currentScene) return;
    
    try {
      const response = await fetch('/api/choice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ choiceId, currentSceneId: currentScene.id }),
      });
      
      const result = (await response.json()) as MakeChoiceResponse;
      
      if (result.status === 'error') {
        setError(result.message);
        return;
      }
      
      setGameState(result.gameState);
      setCurrentScene(result.scene);
    } catch (err) {
      setError('Failed to make choice');
      console.error('Choice error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-2xl mb-4">Loading Choose Your Own Chaos...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-2xl mb-4 text-red-400">Error</div>
          <div className="text-lg">{error}</div>
        </div>
      </div>
    );
  }

  if (!currentScene) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-2xl">No scene loaded</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Choose Your Own Chaos</h1>
        </header>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">{currentScene.title}</h2>
          <p className="text-lg leading-relaxed mb-6">{currentScene.description}</p>
          
          <div className="space-y-3">
            {currentScene.choices.map((choice) => (
              <button
                key={choice.id}
                onClick={() => makeChoice(choice.id)}
                className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors duration-200"
              >
                {choice.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};