// Game state management
let gameState = {
  currentGame: null,
  initialData: null,
  isReady: false,
  gameMode: 'menu', // 'menu' or 'play'
  message: '',
  makingChoice: false,
  userProfile: null
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
    createStoryBtn: document.getElementById('create-story-btn'),
    backToMenuBtn: document.getElementById('backBtn'),
    messageDiv: document.getElementById('message'),
    gameTitle: document.getElementById('gameTitle'),
    gameInfo: document.getElementById('game-info'),
    sceneTitle: document.getElementById('sceneTitle'),
    sceneDescription: document.getElementById('sceneDescription'),
    choicesContainer: document.getElementById('choices'),
    storyHistoryContainer: document.getElementById('story-history'),
    endingScreen: document.getElementById('ending'),
    userProfileContainer: document.getElementById('user-profile')
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
      case 'chaosVoteResult':
        handleChaosVoteResult(message.data);
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
  gameState.userProfile = data.userProfile;
  
  // If there's already a game and game data, load it directly
  if (data.gameId && data.game) {
    console.log('Found existing game with data, switching to play mode:', data.gameId);
    gameState.currentGame = data.game;
    gameState.gameMode = 'play';
    gameState.message = `> LOADING EXISTING CHAOS PROTOCOL: ${data.game.title}`;
    showGameScreen();
  } else if (data.gameId && !data.game) {
    // We have a gameId but no game data, request it
    console.log('Found existing game ID but no data, requesting game data:', data.gameId);
    sendMessageToDevvit({ 
      type: 'getGame', 
      data: { gameId: data.gameId } 
    });
    showLoadingState('> ACCESSING CHAOS DATABASE...');
  } else {
    // No existing game, show menu
    console.log('No existing game found, showing menu');
    gameState.message = '> CHAOS PROTOCOL READY FOR INITIALIZATION';
    showMenuScreen();
  }
}

function handleGameCreated(data) {
  console.log('Game created, switching to play mode:', data);
  if (data.game) {
    // We have the complete game data
    gameState.currentGame = data.game;
    gameState.gameMode = 'play';
    gameState.message = `> CHAOS PROTOCOL INITIALIZED: ${data.game.title}`;
    showGameScreen();
  } else {
    // We only have the gameId, request the full data
    sendMessageToDevvit({ 
      type: 'getGame', 
      data: { gameId: data.gameId } 
    });
    showLoadingState('> LOADING NEW CHAOS INSTANCE...');
  }
}

function handleGameData(data) {
  console.log('Received game data:', data);
  if (data.status === 'success') {
    gameState.currentGame = data.game;
    gameState.gameMode = 'play';
    gameState.message = `> CHAOS PROTOCOL LOADED: ${data.game.title}`;
    showGameScreen();
  } else {
    gameState.message = `> ERROR: CHAOS PROTOCOL CORRUPTED - ${data.message}`;
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
    gameState.message = `> ERROR: CHOICE PROCESSING FAILED - ${data.message}`;
    updateMessage();
  }
}

function handleChaosVoteResult(data) {
  console.log('Chaos vote result:', data);
  
  if (data.status === 'success') {
    // Update the choice with new chaos data
    if (gameState.currentGame) {
      const choice = gameState.currentGame.currentScene.choices.find(c => c.id === data.choice.id);
      if (choice) {
        choice.chaosVotes = data.choice.chaosVotes;
        choice.chaosLevel = data.choice.chaosLevel;
      }
    }
    
    // Update user profile
    gameState.userProfile = data.userProfile;
    
    // Refresh the choices display to show updated chaos meters
    updateChoicesDisplay();
    updateUserProfile();
  } else {
    console.error('Chaos vote failed:', data.message);
  }
}

function handleError(data) {
  console.error('Received error from Devvit:', data);
  gameState.message = `> SYSTEM ERROR: ${data.message}`;
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

function voteChaos(choiceId, voteType) {
  if (!gameState.currentGame) return;
  
  console.log('Voting chaos:', { gameId: gameState.currentGame.id, choiceId, voteType });
  
  sendMessageToDevvit({ 
    type: 'voteChaos', 
    data: { 
      gameId: gameState.currentGame.id, 
      choiceId: choiceId,
      voteType: voteType
    } 
  });
}

// UI Display Functions
function showLoadingState(message = '> INITIALIZING CHAOS PROTOCOL...') {
  hideAllScreens();
  elements.loadingScreen.style.display = 'flex';
  const loadingMessage = elements.loadingScreen.querySelector('.loading-message');
  if (loadingMessage) {
    loadingMessage.textContent = message;
    loadingMessage.classList.add('terminal-cursor');
  }
}

function showMenuScreen() {
  hideAllScreens();
  elements.menuScreen.style.display = 'flex';
  updateMessage();
  updateUserProfile();
}

function showGameScreen() {
  hideAllScreens();
  elements.gameScreen.style.display = 'block';
  updateGameDisplay();
  updateUserProfile();
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
    elements.messageDiv.classList.add('terminal-cursor');
  }
}

function updateUserProfile() {
  if (!elements.userProfileContainer || !gameState.userProfile) return;
  
  const profile = gameState.userProfile;
  const chaosEmoji = getChaosEmoji(profile.globalChaosLevel);
  
  elements.userProfileContainer.innerHTML = `
    <div class="user-chaos-profile">
      <span class="status-badge chaos">CHAOS AGENT: u/${profile.username || 'UNKNOWN'}</span>
      <span class="status-badge info">GLOBAL CHAOS: ${profile.globalChaosLevel.toFixed(1)} ${chaosEmoji}</span>
      <span class="status-badge info">VOTES: ${profile.totalChaosVotes}</span>
    </div>
  `;
}

function getChaosEmoji(chaosLevel) {
  if (chaosLevel < 1.5) return '🥴';
  if (chaosLevel < 2.5) return '🤯';
  return '🤡';
}

function createStatusBadge(text, type = 'info') {
  const badge = document.createElement('span');
  badge.className = `status-badge ${type}`;
  badge.textContent = text;
  return badge;
}

function createChaosVotingButtons(choiceId, chaosVotes, chaosLevel) {
  const container = document.createElement('div');
  container.className = 'chaos-voting';
  
  const meterContainer = document.createElement('div');
  meterContainer.className = 'chaos-meter';
  
  const meterLabel = document.createElement('span');
  meterLabel.className = 'chaos-meter-label';
  meterLabel.textContent = `CHAOS: ${chaosLevel.toFixed(1)}`;
  
  const meterBar = document.createElement('div');
  meterBar.className = 'chaos-meter-bar';
  
  const meterFill = document.createElement('div');
  meterFill.className = 'chaos-meter-fill';
  meterFill.style.width = `${Math.min(chaosLevel * 33.33, 100)}%`;
  
  meterBar.appendChild(meterFill);
  meterContainer.appendChild(meterLabel);
  meterContainer.appendChild(meterBar);
  
  const votingButtons = document.createElement('div');
  votingButtons.className = 'chaos-voting-buttons';
  
  const voteTypes = [
    { type: 'mild', emoji: '🥴', label: 'MILD' },
    { type: 'wild', emoji: '🤯', label: 'WILD' },
    { type: 'insane', emoji: '🤡', label: 'INSANE' }
  ];
  
  voteTypes.forEach(vote => {
    const button = document.createElement('button');
    button.className = 'chaos-vote-btn';
    button.innerHTML = `${vote.emoji} ${chaosVotes[vote.type].length}`;
    button.title = `Vote ${vote.label}`;
    
    // Check if user has already voted this type
    const userId = gameState.initialData?.userId;
    if (userId && chaosVotes[vote.type].includes(userId)) {
      button.classList.add('voted');
    }
    
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      voteChaos(choiceId, vote.type);
    });
    
    votingButtons.appendChild(button);
  });
  
  container.appendChild(meterContainer);
  container.appendChild(votingButtons);
  
  return container;
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
    const createdBy = game.createdByUsername || 'UNKNOWN_USER';
    elements.gameInfo.innerHTML = '';
    
    // Add status badges
    const chaosLevel = createStatusBadge(`CHAOS LEVEL ${game.chaosLevel}`, 'chaos');
    const creator = createStatusBadge(`CREATED BY: u/${createdBy}`, 'info');
    const sceneInfo = createStatusBadge(`SCENE ${scene.id.split('_')[1]}`, 'info');
    
    elements.gameInfo.appendChild(chaosLevel);
    elements.gameInfo.appendChild(creator);
    elements.gameInfo.appendChild(sceneInfo);
  }
  
  // Update story history
  updateStoryHistory();
  
  // Update current scene info with status badges
  if (elements.sceneTitle) {
    elements.sceneTitle.textContent = scene.title;
  }
  
  if (elements.sceneDescription) {
    elements.sceneDescription.textContent = scene.description;
  }
  
  // Update choices
  updateChoicesDisplay();
}

function updateStoryHistory() {
  if (!elements.storyHistoryContainer || !gameState.currentGame) return;
  
  const game = gameState.currentGame;
  elements.storyHistoryContainer.innerHTML = '';
  
  if (game.storyHistory.length === 0) {
    elements.storyHistoryContainer.innerHTML = '<p class="no-history">> BEGINNING OF CHAOS PROTOCOL...</p>';
    return;
  }
  
  // Create story history display
  const historyTitle = document.createElement('h3');
  historyTitle.textContent = '> CHAOS HISTORY LOG';
  historyTitle.className = 'history-title';
  elements.storyHistoryContainer.appendChild(historyTitle);
  
  game.storyHistory.forEach((entry, index) => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    // Add glitch effect randomly for chaos
    if (Math.random() < 0.1) {
      historyItem.classList.add('glitch');
    }
    
    const sceneInfo = document.createElement('div');
    sceneInfo.className = 'history-scene';
    sceneInfo.innerHTML = `
      <h4>${entry.sceneTitle}</h4>
      <p>${entry.sceneDescription}</p>
    `;
    
    const choiceInfo = document.createElement('div');
    choiceInfo.className = 'history-choice';
    const username = entry.chosenByUsername || 'UNKNOWN_USER';
    const timestamp = new Date(entry.timestamp).toLocaleString();
    const chaosLevel = entry.chaosLevel || 0;
    const chaosEmoji = getChaosEmoji(chaosLevel);
    
    choiceInfo.innerHTML = `
      <div class="choice-text">> ${entry.choiceText}</div>
      <div class="choice-meta">
        <span class="choice-user">— u/${username}</span>
        <span class="choice-chaos">CHAOS: ${chaosLevel.toFixed(1)} ${chaosEmoji}</span>
        <span class="choice-time">[${timestamp}]</span>
      </div>
    `;
    
    historyItem.appendChild(sceneInfo);
    historyItem.appendChild(choiceInfo);
    elements.storyHistoryContainer.appendChild(historyItem);
  });
}

function updateChoicesDisplay() {
  if (!elements.choicesContainer || !gameState.currentGame) return;
  
  const scene = gameState.currentGame.currentScene;
  elements.choicesContainer.innerHTML = '';
  
  if (scene.isEnding) {
    // Show ending screen
    elements.choicesContainer.innerHTML = `
      <div class="ending-message">
        <h3>CHAOS PROTOCOL TERMINATED</h3>
        <p>> Thank you for participating in this collaborative chaos experiment</p>
        <p>> The narrative was shaped by ${gameState.currentGame.storyHistory.length} different users</p>
        <p>> Reality.exe has stopped working</p>
      </div>
    `;
    return;
  }
  
  // Add choices title
  const choicesTitle = document.createElement('h3');
  choicesTitle.textContent = '> SELECT CHAOS VECTOR';
  choicesTitle.className = 'choices-title';
  elements.choicesContainer.appendChild(choicesTitle);
  
  // Create choice buttons with chaos voting
  scene.choices.forEach((choice, index) => {
    const choiceContainer = document.createElement('div');
    choiceContainer.className = 'choice-container';
    
    const button = document.createElement('button');
    button.className = 'choice-button';
    button.disabled = gameState.makingChoice;
    
    const choiceNumber = document.createElement('span');
    choiceNumber.className = 'choice-number';
    choiceNumber.textContent = `[${index + 1}]`;
    
    const choiceText = document.createElement('span');
    choiceText.textContent = ` ${choice.text}`;
    
    button.appendChild(choiceNumber);
    button.appendChild(choiceText);
    
    if (gameState.makingChoice) {
      const loadingText = document.createElement('span');
      loadingText.className = 'loading-text';
      loadingText.textContent = ' [PROCESSING...]';
      button.appendChild(loadingText);
    }
    
    button.addEventListener('click', () => makeChoice(choice.id));
    
    // Add chaos voting system
    const chaosVotes = choice.chaosVotes || { mild: [], wild: [], insane: [] };
    const chaosLevel = choice.chaosLevel || 0;
    const votingSystem = createChaosVotingButtons(choice.id, chaosVotes, chaosLevel);
    
    choiceContainer.appendChild(button);
    choiceContainer.appendChild(votingSystem);
    elements.choicesContainer.appendChild(choiceContainer);
  });
}

// Utility functions
function extractSubredditName() {
  // This would need to be implemented based on how the subreddit info is passed
  // For now, return null to show the generic banner
  return null;
}

// Add some terminal effects
function addTerminalEffect() {
  // Add random glitch effects
  setInterval(() => {
    const elements = document.querySelectorAll('.choice-button, .history-item');
    elements.forEach(el => {
      if (Math.random() < 0.05) { // 5% chance
        el.classList.add('glitch');
        setTimeout(() => el.classList.remove('glitch'), 300);
      }
    });
  }, 2000);
}

// Initialize terminal effects when page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(addTerminalEffect, 1000);
});

console.log('> CHAOS PROTOCOL APP.JS LOADED SUCCESSFULLY');