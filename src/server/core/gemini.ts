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
      console.log('Generating initial scene with prompt:', prompt);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('Gemini API response:', text);
      
      // Clean up the response to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No valid JSON found in Gemini response:', text);
        // Return a fallback scene if Gemini fails
        return this.createFallbackScene(title, initialPrompt, chaosLevel);
      }
      
      const sceneData = JSON.parse(jsonMatch[0]);
      
      // Validate the scene data
      if (!sceneData.title || !sceneData.description || !sceneData.choices || !Array.isArray(sceneData.choices)) {
        console.error('Invalid scene data structure:', sceneData);
        return this.createFallbackScene(title, initialPrompt, chaosLevel);
      }

      if (sceneData.choices.length !== 4) {
        console.error('Scene does not have exactly 4 choices:', sceneData.choices);
        return this.createFallbackScene(title, initialPrompt, chaosLevel);
      }
      
      return {
        id: 'scene_0',
        title: sceneData.title,
        description: sceneData.description,
        choices: sceneData.choices.map((choice: any, index: number) => ({
          id: choice.id || `choice${index + 1}`,
          text: choice.text,
          nextSceneId: `scene_${index + 1}`
        }))
      };
    } catch (error) {
      console.error('Error generating initial scene:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      // Return a fallback scene instead of throwing
      return this.createFallbackScene(title, initialPrompt, chaosLevel);
    }
  }

  private createFallbackScene(title: string, initialPrompt: string, chaosLevel: ChaosLevel): GameScene {
    return {
      id: 'scene_0',
      title: `${title} - The Beginning`,
      description: `${initialPrompt}\n\nYou find yourself at the start of an adventure. The chaos level is set to ${chaosLevel}/5, so expect the unexpected! What will you do first?`,
      choices: [
        {
          id: 'choice1',
          text: 'Look around carefully and assess the situation',
          nextSceneId: 'scene_1'
        },
        {
          id: 'choice2',
          text: 'Take immediate action without hesitation',
          nextSceneId: 'scene_2'
        },
        {
          id: 'choice3',
          text: 'Try to find other people or allies',
          nextSceneId: 'scene_3'
        },
        {
          id: 'choice4',
          text: 'Do something completely unexpected',
          nextSceneId: 'scene_4'
        }
      ]
    };
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
      console.log('Generating next scene with prompt:', prompt);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('Gemini API response for next scene:', text);
      
      // Clean up the response to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No valid JSON found in next scene response:', text);
        return this.createFallbackNextScene(chosenChoice, sceneNumber, chaosLevel);
      }
      
      const sceneData = JSON.parse(jsonMatch[0]);
      
      // Validate the scene data
      if (!sceneData.title || !sceneData.description || !sceneData.choices || !Array.isArray(sceneData.choices)) {
        console.error('Invalid next scene data structure:', sceneData);
        return this.createFallbackNextScene(chosenChoice, sceneNumber, chaosLevel);
      }

      if (sceneData.choices.length !== 4) {
        console.error('Next scene does not have exactly 4 choices:', sceneData.choices);
        return this.createFallbackNextScene(chosenChoice, sceneNumber, chaosLevel);
      }
      
      return {
        id: `scene_${sceneNumber}`,
        title: sceneData.title,
        description: sceneData.description,
        choices: sceneData.choices.map((choice: any, index: number) => ({
          id: choice.id || `choice${index + 1}`,
          text: choice.text,
          nextSceneId: `scene_${sceneNumber + index + 1}`
        })),
        isEnding: sceneNumber > 10 && Math.random() < 0.3 // 30% chance of ending after scene 10
      };
    } catch (error) {
      console.error('Error generating next scene:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      // Return a fallback scene instead of throwing
      return this.createFallbackNextScene(chosenChoice, sceneNumber, chaosLevel);
    }
  }

  private createFallbackNextScene(chosenChoice: string, sceneNumber: number, chaosLevel: ChaosLevel): GameScene {
    const chaosDescriptions = [
      'Something unexpected happens...',
      'The situation takes a surprising turn...',
      'Chaos ensues as...',
      'In a twist of fate...',
      'The unpredictable nature of this adventure reveals itself as...'
    ];

    const randomDescription = chaosDescriptions[Math.floor(Math.random() * chaosDescriptions.length)];

    return {
      id: `scene_${sceneNumber}`,
      title: `Scene ${sceneNumber}: Unexpected Turn`,
      description: `After choosing to "${chosenChoice}", ${randomDescription} You find yourself in a new situation that requires quick thinking. The chaos level ${chaosLevel}/5 means anything could happen next!`,
      choices: [
        {
          id: 'choice1',
          text: 'Try to adapt to the new circumstances',
          nextSceneId: `scene_${sceneNumber + 1}`
        },
        {
          id: 'choice2',
          text: 'Fight against the unexpected change',
          nextSceneId: `scene_${sceneNumber + 2}`
        },
        {
          id: 'choice3',
          text: 'Embrace the chaos and go with the flow',
          nextSceneId: `scene_${sceneNumber + 3}`
        },
        {
          id: 'choice4',
          text: 'Try to find a creative solution',
          nextSceneId: `scene_${sceneNumber + 4}`
        }
      ],
      isEnding: sceneNumber > 10 && Math.random() < 0.3
    };
  }
}