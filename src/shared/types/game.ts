export type LetterState = 'correct' | 'present' | 'absent' | 'initial';

type Response<T> = { status: 'error'; message: string } | ({ status: 'success' } & T);

export interface GameChoice {
  id: string;
  text: string;
  nextSceneId: string;
}

export interface GameScene {
  id: string;
  title: string;
  description: string;
  choices: GameChoice[];
  isEnding?: boolean;
}

export interface StoryNode {
  id: string;
  sceneId: string;
  choiceId?: string;
  choiceText?: string;
  chosenBy?: string;
  timestamp: number;
  children: StoryNode[];
  isActive: boolean; // Indicates if this is part of the current active path
}

export interface GameState {
  currentSceneId: string;
  visitedScenes: string[];
  playerChoices: Array<{
    sceneId: string;
    choiceId: string;
    timestamp: number;
  }>;
}

export interface ChaosGame {
  id: string;
  title: string;
  initialPrompt: string;
  chaosLevel: number;
  createdAt: number;
  createdBy: string;
  currentScene: GameScene;
  storyHistory: Array<{
    sceneId: string;
    choiceId: string;
    choiceText: string;
    timestamp: number;
    chosenBy: string;
  }>;
  storyTree: StoryNode; // Root node of the story tree
  activePathIds: string[]; // Array of node IDs representing the current active path
}

export type ChaosLevel = 1 | 2 | 3 | 4 | 5;

export interface CreateGameRequest {
  title: string;
  initialPrompt: string;
  chaosLevel: ChaosLevel;
}

export interface MakeChoiceRequest {
  gameId: string;
  choiceId: string;
}

export type CreateGameResponse = Response<{
  gameId: string;
  postUrl: string;
}>;

export type GetGameResponse = Response<{
  game: ChaosGame;
}>;

export type MakeChoiceResponse = Response<{
  scene: GameScene;
  gameState: GameState;
}>;

export type GetSceneResponse = Response<{
  scene: GameScene;
}>;