import express from 'express';
import { createServer, getContext, getServerPort } from '@devvit/server';
import { InitResponse, MakeChoiceResponse, GetSceneResponse } from '../shared/types/game';
import { postConfigGet, postConfigNew, postConfigMaybeGet, getGameState, saveGameState } from './core/post';
import { getScene } from './core/scenes';
import { getRedis } from '@devvit/redis';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

const router = express.Router();

router.get('/api/init', async (_req, res) => {
  const { postId, userId } = getContext();
  const redis = getRedis();

  if (!postId) {
    res.status(400).json({
      status: 'error',
      message: 'postId is required but missing from context',
    });
    return;
  }

  if (!userId) {
    res.status(400).json({
      status: 'error',
      message: 'Must be logged in to play',
    });
    return;
  }

  try {
    let config = await postConfigMaybeGet({ redis, postId });
    if (!config) {
      await postConfigNew({ redis, postId });
      config = await postConfigGet({ redis, postId });
    }

    const gameState = await getGameState({ redis, postId, userId });

    res.json({
      status: 'success',
      postId: postId,
      gameState: gameState,
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error during initialization';
    res.status(500).json({ status: 'error', message });
  }
});

router.get('/api/scene/:sceneId', async (req, res) => {
  const { sceneId } = req.params;

  if (!sceneId) {
    res.status(400).json({ status: 'error', message: 'Scene ID is required' });
    return;
  }

  const scene = getScene(sceneId);
  if (!scene) {
    res.status(404).json({ status: 'error', message: 'Scene not found' });
    return;
  }

  res.json({
    status: 'success',
    scene: scene,
  });
});

router.post('/api/choice', async (req, res) => {
  const { choiceId, currentSceneId } = req.body;
  const { postId, userId } = getContext();
  const redis = getRedis();

  if (!postId) {
    res.status(400).json({ status: 'error', message: 'postId is required' });
    return;
  }
  if (!userId) {
    res.status(400).json({ status: 'error', message: 'Must be logged in' });
    return;
  }
  if (!choiceId || !currentSceneId) {
    res.status(400).json({ status: 'error', message: 'Choice ID and current scene ID are required' });
    return;
  }

  try {
    const currentScene = getScene(currentSceneId);
    if (!currentScene) {
      res.status(404).json({ status: 'error', message: 'Current scene not found' });
      return;
    }

    const choice = currentScene.choices.find(c => c.id === choiceId);
    if (!choice) {
      res.status(400).json({ status: 'error', message: 'Invalid choice' });
      return;
    }

    const nextScene = getScene(choice.nextSceneId);
    if (!nextScene) {
      res.status(404).json({ status: 'error', message: 'Next scene not found' });
      return;
    }

    const gameState = await getGameState({ redis, postId, userId });
    
    // Update game state
    gameState.currentSceneId = nextScene.id;
    if (!gameState.visitedScenes.includes(nextScene.id)) {
      gameState.visitedScenes.push(nextScene.id);
    }
    gameState.playerChoices.push({
      sceneId: currentSceneId,
      choiceId: choiceId,
      timestamp: Date.now(),
    });

    await saveGameState({ redis, postId, userId, gameState });

    res.json({
      status: 'success',
      scene: nextScene,
      gameState: gameState,
    });
  } catch (error) {
    console.error('Choice error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error making choice';
    res.status(500).json({ status: 'error', message });
  }
});

app.use(router);

const port = getServerPort();
const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port, () => console.log(`http://localhost:${port}`));