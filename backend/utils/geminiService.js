import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

/* ----------------------------- */
/* Environment & Client Setup    */
/* ----------------------------- */

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "FATAL ERROR: GEMINI_API_KEY is not set in the environment variables."
  );
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/* ----------------------------- */
/* Generate Flashcards           */
/* ----------------------------- */
/**
 * Generate flashcards from text
 * @param {string} text - Document text
 * @param {number} count - Number of flashcards to generate
 * @returns {Promise<Array<{question: string, answer: string, difficulty: string}>>}
 */
export const generateFlashcards = async (text, count = 10) => {
  const prompt = `
Generate exactly ${count} educational flashcards from the following text.

Format each flashcard as:
Q: [Clear, specific question]
A: [Concise, accurate answer]
D: [Difficulty level: easy, medium, or hard]

Separate each flashcard with "----"

Text:
${text.substring(0, 15000)}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const generatedText = response.text;

    const flashcards = [];
    const cards = generatedText.split("----").filter((c) => c.trim());

    for (const card of cards) {
      const lines = card.trim().split("\n");
      let question = "";
      let answer = "";
      let difficulty = "medium";

      for (const line of lines) {
        if (line.startsWith("Q:")) {
          question = line.substring(2).trim();
        } else if (line.startsWith("A:")) {
          answer = line.substring(2).trim();
        } else if (line.startsWith("D:")) {
          const diff = line.substring(2).trim().toLowerCase();
          if (["easy", "medium", "hard"].includes(diff)) {
            difficulty = diff;
          }
        }
      }

      if (question && answer) {
        flashcards.push({ question, answer, difficulty });
      }
    }

    return flashcards.slice(0, count);
  } catch (error) {
    console.error("Gemini API error:", error);
    console.log("Using Mock Flashcards as fallback due to API error.");
    const mockFlashcards = [
      {
        question: "What is the primary function of a mitochondria?",
        answer: "It generates most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy.",
        difficulty: "medium"
      },
      {
        question: "Define 'Machine Learning'.",
        answer: "Machine learning is a subset of artificial intelligence that involves training algorithms to learn from and make predictions based on data.",
        difficulty: "easy"
      },
      {
        question: "What is React's Virtual DOM?",
        answer: "A lightweight JavaScript representation of the actual DOM that React uses to optimize rendering performance by calculating diffs.",
        difficulty: "hard"
      },
      {
        question: "What does API stand for?",
        answer: "Application Programming Interface, which allows two or more computer programs to communicate with each other.",
        difficulty: "easy"
      },
      {
        question: "Explain the concept of 'State' in React.",
        answer: "State is a built-in React object that is used to contain data or information about the component that can change over time.",
        difficulty: "medium"
      }
    ];
    return mockFlashcards.slice(0, count);
  }
};

/* ----------------------------- */
/* Generate Quiz Questions       */
/* ----------------------------- */
/**
 * Generate quiz questions
 * @param {string} text - Document text
 * @param {number} numQuestions - Number of questions
 * @returns {Promise<Array<{question: string, options: Array, correctAnswer: string, explanation: string, difficulty: string}>>}
 */
export const generateQuiz = async (text, numQuestions = 5) => {
  const prompt = `
Generate exactly ${numQuestions} multiple choice questions from the following text.
Format each question as:
Q: [Question]
O1: [Option 1]
O2: [Option 2]
O3: [Option 3]
O4: [Option 4]
C: [Correct option – exactly as written above]
E: [Brief explanation]
D: [Difficulty: easy, medium, or hard]

Separate questions with "----"

Text:
${text.substring(0, 15000)}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const generatedText = response.text;

    const questions = [];
    const questionBlocks = generatedText
      .split("----")
      .filter((q) => q.trim());

    for (const block of questionBlocks) {
      const lines = block.trim().split("\n");

      let question = "";
      let options = [];
      let correctAnswer = "";
      let explanation = "";
      let difficulty = "medium";

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith("Q:")) {
          question = trimmed.substring(2).trim();
        } else if (/^O\d:/.test(trimmed)) {
          options.push(trimmed.substring(3).trim());
        } else if (trimmed.startsWith("C:")) {
          correctAnswer = trimmed.substring(2).trim();
        } else if (trimmed.startsWith("E:")) {
          explanation = trimmed.substring(2).trim();
        } else if (trimmed.startsWith("D:")) {
          const diff = trimmed.substring(2).trim().toLowerCase();
          if (["easy", "medium", "hard"].includes(diff)) {
            difficulty = diff;
          }
        }
      }

      if (question && options.length === 4 && correctAnswer) {
        questions.push({
          question,
          options,
          correctAnswer,
          explanation,
          difficulty,
        });
      }
    }

    return questions.slice(0, numQuestions);
  } catch (error) {
    console.error("Gemini API error:", error);
    console.log("Using Mock Quiz as fallback due to API error.");
    const mockQuiz = [
      {
        question: "Which of the following best describes 'Machine Learning'?",
        options: [
          "A type of database management system",
          "Algorithms that learn from and make predictions on data",
          "A frontend web framework",
          "A programming language similar to Python"
        ],
        correctAnswer: "Algorithms that learn from and make predictions on data",
        explanation: "Machine learning focuses on teaching computers to learn from data without being explicitly programmed.",
        difficulty: "easy"
      },
      {
        question: "What is the primary purpose of React's Virtual DOM?",
        options: [
          "To directly modify the browser's DOM",
          "To style components automatically",
          "To optimize rendering performance by calculating diffs",
          "To act as a backend database"
        ],
        correctAnswer: "To optimize rendering performance by calculating diffs",
        explanation: "React uses the Virtual DOM to batch updates and apply only the minimal necessary changes to the real DOM.",
        difficulty: "medium"
      },
      {
        question: "In the context of APIs, what does REST stand for?",
        options: [
          "Representational State Transfer",
          "Registry Entity System Tool",
          "Random Early Simple Transmission",
          "Routing External Server Template"
        ],
        correctAnswer: "Representational State Transfer",
        explanation: "REST is an architectural style for providing standards between computer systems on the web.",
        difficulty: "medium"
      },
      {
        question: "Which CSS framework utilizes utility classes like 'bg-slate-900'?",
        options: [
          "Bootstrap",
          "Materialize",
          "Tailwind CSS",
          "Foundation"
        ],
        correctAnswer: "Tailwind CSS",
        explanation: "Tailwind CSS is a utility-first CSS framework that provides low-level utility classes.",
        difficulty: "easy"
      },
      {
        question: "What is a 'Promise' in JavaScript?",
        options: [
          "A guarantee that code will execute instantly",
          "An object representing the eventual completion or failure of an asynchronous operation",
          "A strictly typed variable",
          "A loop that runs infinitely"
        ],
        correctAnswer: "An object representing the eventual completion or failure of an asynchronous operation",
        explanation: "Promises are used to handle asynchronous operations in JavaScript.",
        difficulty: "hard"
      }
    ];
    return mockQuiz.slice(0, numQuestions);
  }
};

/* ----------------------------- */
/* Generate Summary              */
/* ----------------------------- */
/**
 * Generate document summary
 * @param {string} text - Document text
 * @returns {Promise<string>}
 */
export const generateSummary = async (text) => {
  const prompt = `
Provide a concise summary of the following text, highlighting the key concepts and main ideas.
Keep the summary clear and structured.

Text:
${text.substring(0, 20000)}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("Failed to generate summary");
  }
};

/* ----------------------------- */
/* Chat with Context             */
/* ----------------------------- */
/**
 * Answer a question based on provided document context
 * @param {string} question
 * @param {Array<Object>} chunks
 * @returns {Promise<string>}
 */
export const chatWithContext = async (question, chunks) => {
  const context = chunks.map((c, i) => `Chunk ${i + 1}: ${c.content}`).join("\n");

  const prompt = `You are a helpful and intelligent AI assistant. 
You have been provided with some context from a document the user is reading. 
You can use this context to answer questions about the document, but you are also free to answer any general questions the user asks you, even if they have nothing to do with the document.

Context from the document:
${context}

User's Question: ${question}
Answer:`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("Failed to process chat request");
  }
};

/* ----------------------------- */
/* Generate Chat Title           */
/* ----------------------------- */
/**
 * Generate a short 3-5 word title based on the user's first question
 * @param {string} question - The user's question
 * @returns {Promise<string>}
 */
export const generateChatTitle = async (question) => {
  const prompt = `Generate a short, concise title (maximum 5 words) for a chat session that starts with the following question. 
Do not include quotation marks or prefixes like "Title:". Just the raw title text.

Question: ${question}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    let title = response.text.trim();
    if (title.startsWith('"') && title.endsWith('"')) {
      title = title.substring(1, title.length - 1);
    }
    return title;
  } catch (error) {
    console.error("Gemini API error (generateChatTitle):", error);
    return question.length > 30 ? question.substring(0, 30) + '...' : question;
  }
};

/* ----------------------------- */
/* Explain Concept               */
/* ----------------------------- */
/**
 * Explain a specific concept
 * @param {string} concept - Concept to explain
 * @param {string} context - Relevant context
 * @returns {Promise<string>}
 */
export const explainConcept = async (concept, context) => {
  const prompt = `
Explain the concept of "${concept}" based on the following context.
Provide a clear, educational explanation that is easy to understand.
Include examples if relevant.

Context:
${context.substring(0, 10000)}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("Failed to explain concept");
  }
};
