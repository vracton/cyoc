import { GoogleGenerativeAI } from '@google/generative-ai';
import { GameScene, ChaosLevel } from '../../shared/types/game';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  private getChaosLevelDescription(level: ChaosLevel): string {
    const descriptions = {
      1: 'Mild - Slightly unpredictable with minor twists',
      2: 'Moderate - Some unexpected turns and surprises',
      3: 'Wild - Significant plot twists and chaotic elements',
      4: 'Extreme - Highly unpredictable with major chaos',
      5: 'Maximum Chaos - Completely unpredictable and absurd'
    };
    return descriptions[level];
  }

  async generateInitialScene(
    initialPrompt: string,
    chaosLevel: ChaosLevel,
    title: string
  ): Promise<GameScene> {
    const chaosDescription = this.getChaosLevelDescription(chaosLevel);
    
    const prompt = `
You are creating the opening scene for a "Choose Your Own Adventure" story called "${title}".

Initial Setup: ${initialPrompt}
Chaos Level: ${chaosLevel}/5 - ${chaosDescription}

Create an engaging opening scene that:
1. Sets up the story based on the initial prompt
2. Incorporates the specified chaos level
3. Ends with exactly 4 meaningful choices for the reader
4. Keeps the description under 200 words
5. Makes each choice lead to distinctly different story paths

Format your response as JSON:
{
  "title": "Scene Title",
  "description": "Scene description that sets up the situation",
  "choices": [
    {"id": "choice1", "text": "Choice 1 description"},
    {"id": "choice2", "text": "Choice 2 description"},
    {"id": "choice3", "text": "Choice 3 description"},
    {"id": "choice4", "text": "Choice 4 description"}
  ]
}

Make sure the JSON is valid and properly formatted.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Clean up the response to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      
      const sceneData = JSON.parse(jsonMatch[0]);
      
      return {
        id: 'scene_0',
        title: sceneData.title,
        description: sceneData.description,
        choices: sceneData.choices.map((choice: any, index: number) => ({
          ...choice,
          nextSceneId: `scene_${index + 1}`
        }))
      };
    } catch (error) {
      console.error('Error generating initial scene:', error);
      throw new Error('Failed to generate initial scene');
    }
  }

  async generateNextScene(
    storyHistory: Array<{
      sceneId: string;
      choiceId: string;
      choiceText: string;
      timestamp: number;
      chosenBy: string;
    }>,
    previousScene: GameScene,
    chosenChoice: string,
    chaosLevel: ChaosLevel,
    sceneNumber: number
  ): Promise<GameScene> {
    const chaosDescription = this.getChaosLevelDescription(chaosLevel);
    
    const historyText = storyHistory.map((entry, index) => 
      `${index + 1}. ${entry.choiceText}`
    ).join('\n');

    const prompt = `
You are continuing a "Choose Your Own Adventure" story.

Previous Story Choices:
${historyText}

Previous Scene: ${previousScene.description}
Chosen Action: ${chosenChoice}
Chaos Level: ${chaosLevel}/5 - ${chaosDescription}
Scene Number: ${sceneNumber}

Continue the story by:
1. Building naturally from the chosen action
2. Incorporating the chaos level appropriately
3. Creating an engaging scene under 200 words
4. Providing exactly 4 new choices
5. Escalating tension and stakes as the story progresses

${sceneNumber > 8 ? 'Consider if this might be a good place to end the story with some choices leading to conclusions.' : ''}

Format your response as JSON:
{
  "title": "Scene Title",
  "description": "Scene description continuing from the chosen action",
  "choices": [
    {"id": "choice1", "text": "Choice 1 description"},
    {"id": "choice2", "text": "Choice 2 description"},
    {"id": "choice3", "text": "Choice 3 description"},
    {"id": "choice4", "text": "Choice 4 description"}
  ]
}

Make sure the JSON is valid and properly formatted.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Clean up the response to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      
      const sceneData = JSON.parse(jsonMatch[0]);
      
      return {
        id: `scene_${sceneNumber}`,
        title: sceneData.title,
        description: sceneData.description,
        choices: sceneData.choices.map((choice: any, index: number) => ({
          ...choice,
          nextSceneId: `scene_${sceneNumber + index + 1}`
        })),
        isEnding: sceneNumber > 10 && Math.random() < 0.3 // 30% chance of ending after scene 10
      };
    } catch (error) {
      console.error('Error generating next scene:', error);
      throw new Error('Failed to generate next scene');
    }
  }
}