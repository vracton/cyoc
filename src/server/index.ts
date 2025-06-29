import express from 'express';
import { createServer, getContext, getServerPort } from '@devvit/server';
import { 
  CheckResponse, 
  InitResponse, 
  LetterState,
  CreateGameResponse,
  GetGameResponse,
  MakeChoiceResponse,
  CreateGameRequest,
  MakeChoiceRequest
} from '../shared/types/game';
import { postConfigGet, postConfigNew, postConfigMaybeGet } from './core/post';
import { allWords } from './core/words';
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

// Legacy Wordle API Routes (keeping for compatibility)
router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    const { postId, redis } = getContext();

    if (!postId) {
      console.error('API Init Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      let config = await postConfigMaybeGet({ redis, postId });
      if (!config) {
        console.log(`No valid config found for post ${postId}, creating new one.`);
        await postConfigNew({ redis, postId });
        config = await postConfigGet({ redis, postId });
      }

      res.json({
        status: 'success',
        postId: postId,
        gameState: {
          currentSceneId: 'start',
          visitedScenes: ['start'],
          playerChoices: []
        }
      });
    } catch (error) {
      console.error(`API Init Error for post ${postId}:`, error);
      const message =
        error instanceof Error ? error.message : 'Unknown error during initialization';
      res.status(500).json({ status: 'error', message });
    }
  }
);

router.post<{ postId: string }, CheckResponse, { guess: string }>(
  '/api/check',
  async (req, res): Promise<void> => {
    const { guess } = req.body;
    const { postId, userId, redis } = getContext();

    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId is required' });
      return;
    }
    if (!userId) {
      res.status(400).json({ status: 'error', message: 'Must be logged in' });
      return;
    }
    if (!guess) {
      res.status(400).json({ status: 'error', message: 'Guess is required' });
      return;
    }

    try {
      const config = await postConfigGet({ redis, postId });
      const wordOfTheDay = 'chaos'; // Default word for testing

      const normalizedGuess = guess.toLowerCase();

      if (normalizedGuess.length !== 5) {
        res.status(400).json({ status: 'error', message: 'Guess must be 5 letters long' });
        return;
      }

      const wordExists = allWords.includes(normalizedGuess);

      if (!wordExists) {
        res.json({
          status: 'success',
          exists: false,
          solved: false,
          correct: Array(5).fill('initial') as [
            LetterState,
            LetterState,
            LetterState,
            LetterState,
            LetterState,
          ],
        });
        return;
      }

      const answerLetters = wordOfTheDay.split('');
      const resultCorrect: LetterState[] = Array(5).fill('initial');
      let solved = true;
      const guessLetters = normalizedGuess.split('');

      for (let i = 0; i < 5; i++) {
        if (guessLetters[i] === answerLetters[i]) {
          resultCorrect[i] = 'correct';
          answerLetters[i] = '';
        } else {
          solved = false;
        }
      }

      for (let i = 0; i < 5; i++) {
        if (resultCorrect[i] === 'initial') {
          const guessedLetter = guessLetters[i]!;
          const presentIndex = answerLetters.indexOf(guessedLetter);
          if (presentIndex !== -1) {
            resultCorrect[i] = 'present';
            answerLetters[presentIndex] = '';
          }
        }
      }

      for (let i = 0; i < 5; i++) {
        if (resultCorrect[i] === 'initial') {
          resultCorrect[i] = 'absent';
        }
      }

      res.json({
        status: 'success',
        exists: true,
        solved,
        correct: resultCorrect as [LetterState, LetterState, LetterState, LetterState, LetterState],
      });
    } catch (error) {
      console.error('Error in check endpoint:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Internal server error' 
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