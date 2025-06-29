// Game state management
let gameState = {
  currentGame: null,
  initialData: null,
  isReady: false,
  gameMode: 'menu', // 'menu' or 'play'
  message: '',
  makingChoice: false
};

// DOM elements
let elements = {};

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing app');
  initializeElements();
  setupEventListeners();
  showLoadingState();
  
  // Send ready message to Devvit
  console.log('Sending webViewReady message to Devvit');
  sendMessageToDevvit({ type: 'webViewReady' });
});

function initializeElements() {
  elements = {
    app: document.getElementById('app'),
    loadingScreen: document.getElementById('loading-screen'),
    menuScreen: document.getElementById('menu-screen'),
    gameScreen: document.getElementById('game-screen'),
    createStoryBtn: document.getElementById('create-story-btn'),
    backToMenuBtn: document.getElementById('back-to-menu-btn'),
    messageDiv: document.getElementById('message'),
    gameTitle: document.getElementById('game-title'),
    gameInfo: document.getElementById('game-info'),
    sceneTitle: document.getElementById('scene-title'),
    sceneDescription: document.getElementById('scene-description'),
    choicesContainer: document.getElementById('choices-container'),
    endingScreen: document.getElementById('ending-screen')
  };
  print(elements)
}

function setupEventListeners() {
  // Create story button
  if (elements.createStoryBtn) {
    elements.createStoryBtn.addEventListener('click', handleCreateStoryClick);
  }
  
  // Back to menu button
  if (elements.backToMenuBtn) {
    elements.backToMenuBtn.addEventListener('click', handleBackToMenu);
  }
  
  // Listen for messages from Devvit
  window.addEventListener('message', handleDevvitMessage);
}

function sendMessageToDevvit(message) {
  console.log('Sending message to Devvit:', message);
  window.parent.postMessage(message, '*');
}

function handleDevvitMessage(event) {
  console.log('Received message from Devvit:', event.data);
  
  if (event.data && event.data.type === 'devvit-message') {
    const message = event.data.data.message;
    console.log('Processing Devvit message:', message);
    
    switch (message.type) {
      case 'initialData':
        handleInitialData(message.data);
        break;
      case 'gameCreated':
        handleGameCreated(message.data);
        break;
      case 'gameData':
        handleGameData(message.data);
        break;
      case 'choiceResult':
        handleChoiceResult(message.data);
        break;
      case 'error':
        handleError(message.data);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }
}

function handleInitialData(data) {
  console.log('Handling initial data:', data);
  gameState.initialData = data;
  gameState.isReady = true;
  
  // If there's already a game and game data, load it directly
  if (data.gameId && data.game) {
    console.log('Found existing game with data, switching to play mode:', data.gameId);
    gameState.currentGame = data.game;
    gameState.gameMode = 'play';
    gameState.message = `Loading existing game: ${data.game.title}`;
    showGameScreen();
  } else if (data.gameId && !data.game) {
    // We have a gameId but no game data, request it
    console.log('Found existing game ID but no data, requesting game data:', data.gameId);
    sendMessageToDevvit({ 
      type: 'getGame', 
      data: { gameId: data.gameId } 
    });
    showLoadingState('Loading existing game...');
  } else {
    // No existing game, show menu
    console.log('No existing game found, showing menu');
    gameState.message = 'Ready to create a new chaos story!';
    showMenuScreen();
  }
}

function handleGameCreated(data) {
  console.log('Game created, switching to play mode:', data);
  if (data.game) {
    // We have the complete game data
    gameState.currentGame = data.game;
    gameState.gameMode = 'play';
    gameState.message = `Game created successfully! ${data.game.title}`;
    showGameScreen();
  } else {
    // We only have the gameId, request the full data
    sendMessageToDevvit({ 
      type: 'getGame', 
      data: { gameId: data.gameId } 
    });
    showLoadingState('Loading new game...');
  }
}

function handleGameData(data) {
  console.log('Received game data:', data);
  if (data.status === 'success') {
    gameState.currentGame = data.game;
    gameState.gameMode = 'play';
    gameState.message = `Loaded game: ${data.game.title}`;
    showGameScreen();
  } else {
    gameState.message = `Error loading game: ${data.message}`;
    showMenuScreen();
  }
}

function handleChoiceResult(data) {
  console.log('Choice result:', data);
  gameState.makingChoice = false;
  
  if (data.status === 'success') {
    // Update the current game with the new scene
    if (gameState.currentGame && data.game) {
      gameState.currentGame = data.game;
      gameState.currentGame.currentScene = data.scene;
    }
    updateGameDisplay();
  } else {
    gameState.message = `Error making choice: ${data.message}`;
    updateMessage();
  }
}

function handleError(data) {
  console.error('Received error from Devvit:', data);
  gameState.message = `Error: ${data.message}`;
  updateMessage();
}

function handleCreateStoryClick() {
  console.log('Create story button clicked');
  sendMessageToDevvit({ type: 'showCreateForm' });
}

function handleBackToMenu() {
  gameState.gameMode = 'menu';
  gameState.currentGame = null;
  showMenuScreen();
}

function makeChoice(choiceId) {
  if (!gameState.currentGame || gameState.makingChoice) return;
  
  console.log('Making choice:', { gameId: gameState.currentGame.id, choiceId });
  gameState.makingChoice = true;
  
  // Update UI to show loading state
  updateChoicesDisplay();
  
  sendMessageToDevvit({ 
    type: 'makeChoice', 
    data: { 
      gameId: gameState.currentGame.id, 
      choiceId: choiceId 
    } 
  });
}

// UI Display Functions
function showLoadingState(message = 'Initializing interactive story system...') {
  hideAllScreens();
  elements.loadingScreen.style.display = 'flex';
  const loadingMessage = elements.loadingScreen.querySelector('.loading-message');
  if (loadingMessage) {
    loadingMessage.textContent = message;
  }
}

function showMenuScreen() {
  hideAllScreens();
  elements.menuScreen.style.display = 'flex';
  updateMessage();
}

function showGameScreen() {
  hideAllScreens();
  elements.gameScreen.style.display = 'block';
  updateGameDisplay();
}

function hideAllScreens() {
  elements.loadingScreen.style.display = 'none';
  elements.menuScreen.style.display = 'none';
  elements.gameScreen.style.display = 'none';
}

function updateMessage() {
  if (elements.messageDiv && gameState.message) {
    elements.messageDiv.textContent = gameState.message;
    elements.messageDiv.style.display = 'block';
  }
}

function updateGameDisplay() {
  if (!gameState.currentGame) return;
  
  const game = gameState.currentGame;
  const scene = game.currentScene;
  
  // Update game info
  if (elements.gameTitle) {
    elements.gameTitle.textContent = game.title;
  }
  
  if (elements.gameInfo) {
    elements.gameInfo.textContent = `Chaos Level: ${game.chaosLevel}/5 | Scene: ${scene.id}`;
  }
  
  // Update scene info
  if (elements.sceneTitle) {
    elements.sceneTitle.textContent = scene.title;
  }
  
  if (elements.sceneDescription) {
    elements.sceneDescription.textContent = scene.description;
  }
  
  // Update choices
  updateChoicesDisplay();
}

function updateChoicesDisplay() {
  if (!elements.choicesContainer || !gameState.currentGame) return;
  
  const scene = gameState.currentGame.currentScene;
  elements.choicesContainer.innerHTML = '';
  
  if (scene.isEnding) {
    // Show ending screen
    elements.choicesContainer.innerHTML = `
      <div class="ending-message">
        <h3>The End</h3>
        <p>Thank you for playing!</p>
      </div>
    `;
    return;
  }
  
  // Create choice buttons
  scene.choices.forEach((choice, index) => {
    const button = document.createElement('button');
    button.className = 'choice-button';
    button.disabled = gameState.makingChoice;
    
    const choiceNumber = document.createElement('span');
    choiceNumber.className = 'choice-number';
    choiceNumber.textContent = `${index + 1}.`;
    
    const choiceText = document.createElement('span');
    choiceText.textContent = ` ${choice.text}`;
    
    button.appendChild(choiceNumber);
    button.appendChild(choiceText);
    
    if (gameState.makingChoice) {
      const loadingText = document.createElement('span');
      loadingText.className = 'loading-text';
      loadingText.textContent = ' (Processing...)';
      button.appendChild(loadingText);
    }
    
    button.addEventListener('click', () => makeChoice(choice.id));
    elements.choicesContainer.appendChild(button);
  });
}

// Utility functions
function extractSubredditName() {
  // This would need to be implemented based on how the subreddit info is passed
  // For now, return null to show the generic banner
  return null;
}

console.log('App.js loaded successfully');