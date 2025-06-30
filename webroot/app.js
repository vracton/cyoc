// Game state management
let gameState = {
  currentGame: null,
  initialData: null,
  isReady: false,
  gameMode: 'menu', // 'menu' or 'play'
  message: '',
  makingChoice: false,
  showHistoryTree: false
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
    loadingScreen: document.getElementById('loading'),
    menuScreen: document.getElementById('menu'),
    gameScreen: document.getElementById('game'),
    createStoryBtn: document.getElementById('createStoryBtn'),
    backToMenuBtn: document.getElementById('backBtn'),
    messageDiv: document.getElementById('message'),
    gameTitle: document.getElementById('gameTitle'),
    gameInfo: document.getElementById('game-info'),
    sceneTitle: document.getElementById('sceneTitle'),
    sceneDescription: document.getElementById('sceneDescription'),
    choicesContainer: document.getElementById('choices'),
    endingScreen: document.getElementById('ending'),
    historyToggleBtn: document.getElementById('historyToggleBtn'),
    historyTreeContainer: document.getElementById('historyTree')
  };
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
  
  // History toggle button
  if (elements.historyToggleBtn) {
    elements.historyToggleBtn.addEventListener('click', toggleHistoryTree);
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
    updateHistoryTree();
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
  gameState.showHistoryTree = false;
  showMenuScreen();
}

function toggleHistoryTree() {
  gameState.showHistoryTree = !gameState.showHistoryTree;
  updateHistoryTreeVisibility();
  updateHistoryTree();
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
  updateHistoryTreeVisibility();
  updateHistoryTree();
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
    button.className = 'choice-btn';
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
      loadingText.className = 'processing';
      loadingText.textContent = ' (Processing...)';
      button.appendChild(loadingText);
    }
    
    button.addEventListener('click', () => makeChoice(choice.id));
    elements.choicesContainer.appendChild(button);
  });
}

function updateHistoryTreeVisibility() {
  if (!elements.historyToggleBtn || !elements.historyTreeContainer) return;
  
  if (gameState.showHistoryTree) {
    elements.historyTreeContainer.style.display = 'block';
    elements.historyToggleBtn.textContent = 'Hide Story Tree';
  } else {
    elements.historyTreeContainer.style.display = 'none';
    elements.historyToggleBtn.textContent = 'Show Story Tree';
  }
}

function updateHistoryTree() {
  if (!elements.historyTreeContainer || !gameState.currentGame || !gameState.showHistoryTree) return;
  
  const game = gameState.currentGame;
  if (!game.storyTree) return;
  
  elements.historyTreeContainer.innerHTML = '<h3>Story History Tree</h3>';
  
  const treeContainer = document.createElement('div');
  treeContainer.className = 'tree-container';
  
  renderStoryNode(game.storyTree, treeContainer, 0, game);
  
  elements.historyTreeContainer.appendChild(treeContainer);
}

function renderStoryNode(node, container, depth, game) {
  const nodeElement = document.createElement('div');
  nodeElement.className = `tree-node depth-${depth}`;
  
  if (node.isActive) {
    nodeElement.classList.add('active-path');
  }
  
  // Create indentation
  const indent = document.createElement('div');
  indent.className = 'node-indent';
  indent.style.marginLeft = `${depth * 20}px`;
  
  // Node content
  const nodeContent = document.createElement('div');
  nodeContent.className = 'node-content';
  
  if (node.id === 'root') {
    // Root node - show initial scene
    const scene = findSceneById(game.currentScene.id === node.sceneId ? game.currentScene : null, node.sceneId);
    nodeContent.innerHTML = `
      <div class="scene-info">
        <strong>📖 ${scene ? scene.title : 'Initial Scene'}</strong>
        <div class="scene-desc">${scene ? scene.description.substring(0, 100) + '...' : 'Starting point'}</div>
      </div>
    `;
  } else {
    // Choice node
    const choiceInfo = document.createElement('div');
    choiceInfo.className = 'choice-info';
    
    const choiceText = document.createElement('div');
    choiceText.className = 'choice-text';
    choiceText.textContent = `➤ ${node.choiceText}`;
    
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    userInfo.textContent = `by u/${node.chosenBy || 'unknown'}`;
    
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date(node.timestamp).toLocaleTimeString();
    
    choiceInfo.appendChild(choiceText);
    choiceInfo.appendChild(userInfo);
    choiceInfo.appendChild(timestamp);
    
    nodeContent.appendChild(choiceInfo);
  }
  
  indent.appendChild(nodeContent);
  nodeElement.appendChild(indent);
  container.appendChild(nodeElement);
  
  // Render children
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => {
      renderStoryNode(child, container, depth + 1, game);
    });
  }
}

function findSceneById(currentScene, sceneId) {
  if (currentScene && currentScene.id === sceneId) {
    return currentScene;
  }
  // For now, return null if we can't find the scene
  // In a full implementation, you might want to store all scenes
  return null;
}

// Utility functions
function extractSubredditName() {
  // This would need to be implemented based on how the subreddit info is passed
  // For now, return null to show the generic banner
  return null;
}

console.log('App.js loaded successfully');