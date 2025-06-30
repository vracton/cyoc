export type LetterState = 'correct' | 'present' | 'absent' | 'initial';

type Response<T> = { status: 'error'; message: string } | ({ status: 'success' } & T);

export interface GameChoice {
  id: string;
  text: string;
  nextSceneId: string;
}

export interface ChaosVotes {
  mild: string[]; // Array of user IDs who voted mild (🥴)
  wild: string[]; // Array of user IDs who voted wild (🤯)
  insane: string[]; // Array of user IDs who voted insane (🤡)
}

export interface GameScene {
  id: string;
  title: string;
  description: string;
  choices: GameChoice[];
  isEnding?: boolean;
}

export interface StoryHistoryEntry {
  sceneId: string;
  sceneTitle: string;
  sceneDescription: string;
  choiceId: string;
  choiceText: string;
  timestamp: number;
  chosenBy: string;
  chosenByUsername?: string; // Reddit username for display
  chaosVotes?: ChaosVotes; // Votes on how chaotic this choice was
  chaosLevel?: number; // Calculated average chaos level
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

export interface UserChaosProfile {
  userId: string;
  username?: string;
  totalChaosVotes: number;
  chaosContributions: {
    mild: number;
    wild: number;
    insane: number;
  };
  globalChaosLevel: number; // Calculated based on voting patterns
  lastUpdated: number;
}

export interface ChaosGame {
  id: string;
  title: string;
  initialPrompt: string;
  chaosLevel: number;
  createdAt: number;
  createdBy: string;
  createdByUsername?: string; // Reddit username for display
  currentScene: GameScene;
  storyHistory: StoryHistoryEntry[];
}

export type ChaosLevel = 1 | 2 | 3 | 4 | 5;

export type ChaosVoteType = 'mild' | 'wild' | 'insane';

export interface CreateGameRequest {
  title: string;
  initialPrompt: string;
  chaosLevel: ChaosLevel;
}

export interface MakeChoiceRequest {
  gameId: string;
  choiceId: string;
}

export interface VoteChaosRequest {
  gameId: string;
  historyIndex: number; // Index in the story history array
  voteType: ChaosVoteType;
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

export type VoteChaosResponse = Response<{
  historyEntry: StoryHistoryEntry;
  userProfile: UserChaosProfile;
}>;