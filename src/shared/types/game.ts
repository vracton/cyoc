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

export interface GameState {
  currentSceneId: string;
  visitedScenes: string[];
  playerChoices: Array<{
    sceneId: string;
    choiceId: string;
    timestamp: number;
  }>;
}

export type InitResponse = Response<{
  postId: string;
  gameState: GameState;
}>;

export type MakeChoiceResponse = Response<{
  scene: GameScene;
  gameState: GameState;
}>;

export type GetSceneResponse = Response<{
  scene: GameScene;
}>;