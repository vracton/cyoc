import express from 'express';
import { createServer, getContext, getServerPort } from '@devvit/server';
import { 
  CreateGameResponse,
  GetGameResponse,
  MakeChoiceResponse,
  CreateGameRequest,
  MakeChoiceRequest
} from '../shared/types/game';
import { postConfigGet, postConfigNew, postConfigMaybeGet } from './core/post';
import { GeminiService } from './core/gemini';
import { ChaosGameService } from './core/chaos-game';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

// Service instances - will be initialized on first request
let geminiService: GeminiService | null = null;
let chaosGameService: ChaosGameService | null = null;

const ensureServicesInitialized = async () => {
  if (geminiService && chaosGameService) {
    return; // Already initialized
  }

  try {
    const { getSecret, redis } = getContext();
    const geminiApiKey = "AIzaSyCEkDS-IGaotnNq2koQMipzEMr5XIwbASg";//await getSecret('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY secret not found. Please set it up in your Devvit app settings.');
      throw new Error('GEMINI_API_KEY not configured');
    }

    geminiService = new GeminiService(geminiApiKey);
    chaosGameService = new ChaosGameService(redis, geminiService);
    console.log('Gemini and ChaosGame services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    throw error;
  }
};

// Chaos Game API Routes
router.post<{}, CreateGameResponse, CreateGameRequest>(
  '/api/chaos/create',
  async (req, res): Promise<void> => {
    const { title, initialPrompt, chaosLevel } = req.body;
    const { userId } = getContext();

    if (!userId) {
      res.status(401).json({ status: 'error', message: 'Must be logged in' });
      return;
    }

    try {
      await ensureServicesInitialized();
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Service initialization failed' });
      return;
    }

    if (!chaosGameService) {
      res.status(500).json({ status: 'error', message: 'Game service not initialized' });
      return;
    }

    if (!title || !initialPrompt || !chaosLevel) {
      res.status(400).json({ 
        status: 'error', 
        message: 'Title, initial prompt, and chaos level are required' 
      });
      return;
    }

    if (chaosLevel < 1 || chaosLevel > 5) {
      res.status(400).json({ 
        status: 'error', 
        message: 'Chaos level must be between 1 and 5' 
      });
      return;
    }

    try {
      const game = await chaosGameService.createGame(title, initialPrompt, chaosLevel, userId);
      
      res.json({
        status: 'success',
        gameId: game.id,
        postUrl: `/game/${game.id}` // This will be handled by the Devvit app
      });
    } catch (error) {
      console.error('Error creating chaos game:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to create game' 
      });
    }
  }
);

router.get<{ gameId: string }, GetGameResponse>(
  '/api/chaos/game/:gameId',
  async (req, res): Promise<void> => {
    const { gameId } = req.params;

    try {
      await ensureServicesInitialized();
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Service initialization failed' });
      return;
    }

    if (!chaosGameService) {
      res.status(500).json({ status: 'error', message: 'Game service not initialized' });
      return;
    }

    try {
      const game = await chaosGameService.getGame(gameId);
      
      if (!game) {
        res.status(404).json({ status: 'error', message: 'Game not found' });
        return;
      }

      res.json({
        status: 'success',
        game
      });
    } catch (error) {
      console.error('Error fetching game:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to fetch game' 
      });
    }
  }
);

router.post<{}, MakeChoiceResponse, MakeChoiceRequest>(
  '/api/chaos/choice',
  async (req, res): Promise<void> => {
    const { gameId, choiceId } = req.body;
    const { userId } = getContext();

    if (!userId) {
      res.status(401).json({ status: 'error', message: 'Must be logged in' });
      return;
    }

    try {
      await ensureServicesInitialized();
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Service initialization failed' });
      return;
    }

    if (!chaosGameService) {
      res.status(500).json({ status: 'error', message: 'Game service not initialized' });
      return;
    }

    if (!gameId || !choiceId) {
      res.status(400).json({ 
        status: 'error', 
        message: 'Game ID and choice ID are required' 
      });
      return;
    }

    try {
      const { game, newScene } = await chaosGameService.makeChoice(gameId, choiceId, userId);
      
      res.json({
        status: 'success',
        scene: newScene,
        gameState: {
          currentSceneId: newScene.id,
          visitedScenes: game.storyHistory.map(h => h.sceneId),
          playerChoices: game.storyHistory.map(h => ({
            sceneId: h.sceneId,
            choiceId: h.choiceId,
            timestamp: h.timestamp
          }))
        }
      });
    } catch (error) {
      console.error('Error making choice:', error);
      res.status(500).json({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Failed to make choice'
      });
    }
  }
);

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port, () => console.log(`http://localhost:${port}`));