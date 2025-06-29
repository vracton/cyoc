import { GameScene } from '../../shared/types/game';

export const gameScenes: Record<string, GameScene> = {
  start: {
    id: 'start',
    title: 'The Beginning',
    description: 'Welcome to Choose Your Own Chaos. This is where your adventure begins.',
    choices: [
      {
        id: 'choice1',
        text: 'Make your first choice',
        nextSceneId: 'scene2'
      }
    ]
  },
  
  scene2: {
    id: 'scene2',
    title: 'Second Scene',
    description: 'You have made your first choice and arrived at the second scene.',
    choices: [
      {
        id: 'restart',
        text: 'Start over',
        nextSceneId: 'start'
      }
    ]
  }
};

export const getScene = (sceneId: string): GameScene | undefined => {
  return gameScenes[sceneId];
};