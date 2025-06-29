import { Context } from '@devvit/public-api';
import { RedisClient } from '@devvit/redis';
import { GameState } from '../../shared/types/game';

type PostConfig = {
  gameId: string;
  createdAt: number;
  wordOfTheDay?: string;
};

const getPostConfigKey = (postId: string) => `post_config:${postId}` as const;
const getGameStateKey = (postId: string, userId: string) => `game_state:${postId}:${userId}` as const;

export const postConfigMaybeGet = async ({
  redis,
  postId,
}: {
  redis: Context['redis'] | RedisClient;
  postId: string;
}): Promise<PostConfig | undefined> => {
  const config = await redis.get(getPostConfigKey(postId));
  return config ? JSON.parse(config) : undefined;
};

export const postConfigGet = async ({
  redis,
  postId,
}: {
  redis: Context['redis'] | RedisClient;
  postId: string;
}): Promise<PostConfig> => {
  const config = await postConfigMaybeGet({ redis, postId });
  if (!config) throw new Error('Post config not found');
  return config;
};

export const postConfigSet = async ({
  redis,
  postId,
  config,
}: {
  redis: Context['redis'];
  postId: string;
  config: Partial<PostConfig>;
}): Promise<void> => {
  await redis.set(getPostConfigKey(postId), JSON.stringify(config));
};

export const postConfigNew = async ({
  redis,
  postId,
}: {
  redis: Context['redis'] | RedisClient;
  postId: string;
}): Promise<void> => {
  const gameId = `chaos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await redis.set(getPostConfigKey(postId), JSON.stringify({ 
    gameId,
    createdAt: Date.now(),
    wordOfTheDay: 'chaos' // Default word for legacy compatibility
  } satisfies PostConfig));
};

export const getGameState = async ({
  redis,
  postId,
  userId,
}: {
  redis: Context['redis'] | RedisClient;
  postId: string;
  userId: string;
}): Promise<GameState> => {
  const stateData = await redis.get(getGameStateKey(postId, userId));
  
  if (stateData) {
    return JSON.parse(stateData);
  }
  
  // Return initial game state
  return {
    currentSceneId: 'start',
    visitedScenes: ['start'],
    playerChoices: []
  };
};

export const saveGameState = async ({
  redis,
  postId,
  userId,
  gameState,
}: {
  redis: Context['redis'] | RedisClient;
  postId: string;
  userId: string;
  gameState: GameState;
}): Promise<void> => {
  await redis.set(getGameStateKey(postId, userId), JSON.stringify(gameState));
};