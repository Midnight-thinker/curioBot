import Document from "../models/Document.js";
import Flashcard from "../models/Flashcard.js";
import Quiz from "../models/Quiz.js";
import ChatHistory from "../models/ChatHistory.js";
import * as geminiService from '../utils/geminiService.js';
import { findRelevantChunks } from "../utils/textChunker.js";
import { parse } from "dotenv";


// @desc    Generate flashcard for a document
// @route   POST /api/ai/generate-flashcards
// @access  Private
export const generateFlashcards = async (req, res, next) => {

    try {
        const { documentId, count = 10 } = req.body;

        if (!documentId) {
            return res.status(400).json({ success: false, error: 'Document ID is required', statusCode: 400 });
        }

        const document = await Document.findOne({
            _id: documentId,
            userId: req.user._id,
            status: 'ready'
        });

        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found or not ready', statusCode: 404 });
        }

        // Generate flashcards using geminiService
        const cards = await geminiService.generateFlashcards(document.extractedText, parseInt(count));

        //save to database
        const flashcardSets = await Flashcard.create({
            userId: req.user._id,
            documentId: document._id,
            cards: cards.map(card => ({
                question: card.question,
                answer: card.answer,
                difficulty: card.difficulty,
                reviewCount: 0,
                isStarted: false,
            }))
        });

        res.status(200).json({
            success: true,
            data: flashcardSets,
            message: 'Flashcards generated successfully'
        });



    } catch (error) {
        next(error);
    }
}


// @desc    Generate quiz for a document
// @route   POST /api/ai/generate-quiz
// @access  Private

export const generateQuiz = async (req, res, next) => {
    try {

        const { documentId, numQuestions = 5 ,title} = req.body;

        if (!documentId) {
            return res.status(400).json({ success: false, error: 'Document ID is required', statusCode: 400 });
        }

        const document = await Document.findOne({
            _id: documentId,
            userId: req.user._id,
            status: 'ready'
        });

        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found or not ready', statusCode: 404 });
        }

        // Generate quiz using geminiService
        const questions = await geminiService.generateQuiz(document.extractedText, parseInt(numQuestions));

        // Save to database
        const quiz = await Quiz.create({
            userId: req.user._id,
            documentId: document._id,
            title: title || `Quiz for ${document.title}`,
            questions:questions,
            totalQuestions: questions.length,
            userAnswers: [],
            score: 0,
        });

        res.status(200).json({
            success: true,
            data: quiz,
            message: 'Quiz generated successfully'
        });


    } catch (error) {
        next(error);
    }
}

// @desc    Generate summary for a document
// @route   POST /api/ai/generate-summary
// @access  Private
export const generateSummary = async (req, res, next) => {
    try {
        const { documentId } = req.body;
        if (!documentId) {
            return res.status(400).json({ success: false, error: 'Document ID is required', statusCode: 400 });
        }

        const document = await Document.findOne({
            _id: documentId,
            userId: req.user._id,
            status: 'ready'
        });

        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found or not ready', statusCode: 404 });
        }

        // Generate summary using geminiService
        const summary = await geminiService.generateSummary(document.extractedText);

        res.status(200).json({
            success: true,
            data: {
                documentId: document._id,
                title: document.title,
                summary
            },
            message: 'Summary generated successfully'
        });

    } catch (error) {
        next(error);
    }
}

// @desc    Chat with document
// @route   POST /api/ai/chat
// @access  Private
export const chat = async (req, res, next) => {
    try {
        const { documentId, question, chatId } = req.body;

        if (!documentId || !question) {
            return res.status(400).json({ success: false, error: 'Document ID and question are required', statusCode: 400 });
        }

        const document = await Document.findOne({
            _id: documentId,
            userId: req.user._id,
            status: 'ready'
        });


        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found or not ready', statusCode: 404 });
        }

        // Find relevant chunks
        const chunks = findRelevantChunks(document.chunks, question, 5);
        const chunkIndices = chunks.map(c => c.chunkIndex);


        let chatHistory;
        if (chatId) {
            chatHistory = await ChatHistory.findOne({
                _id: chatId,
                userId: req.user._id,
                documentId: document._id
            });
            if (!chatHistory) {
                return res.status(404).json({ success: false, error: 'Chat session not found', statusCode: 404 });
            }
        } else {
            const title = await geminiService.generateChatTitle(question);
            chatHistory = await ChatHistory.create({
                userId: req.user._id,
                documentId: document._id,
                title: title,
                messages: []
            });
        }

        // generate response from geminiService
        const answer = await geminiService.chatWithContext(question, chunks);

        // save conversation to chat history
        chatHistory.messages.push({
            role:'user',
            content:question,
            timestamp:new Date(),
            relevantChunks:[]
        },
        {            role:'assistant',
            content:answer,
            timestamp:new Date(),
            relevantChunks:chunkIndices
        });
        await chatHistory.save();


        res.status(200).json({
            success: true,
            data: {
                question,
                answer,
                relevantChunks: chunkIndices,
                chatHistoryId: chatHistory._id,
                title: chatHistory.title
            },
            message: 'Chat response generated successfully'
        });
    } catch (error) {
        next(error);
    }
};


// @desc    Explain concept
// @route   POST /api/ai/explain-concept
// @access  Private
export const explainConcept = async (req, res, next) => {
    try {

        const { documentId, concept } = req.body;

        if (!documentId || !concept) {
            return res.status(400).json({ success: false, error: 'Document ID and concept are required', statusCode: 400 });
        }


        const document = await Document.findOne({
            _id: documentId,
            userId: req.user._id,
            status: 'ready'
        });
        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found or not ready', statusCode: 404 });
        }

        // find relevant chunks
        const chunks = findRelevantChunks(document.chunks, concept,3);
        const context = chunks.map(c => c.content).join("\n\n");

        // generate explanation from geminiService
        const explanation = await geminiService.explainConcept(concept, context);

        res.status(200).json({
            success: true,
            data: {
                concept,
                explanation,
                relevantChunks: chunks.map(c => c.chunkIndex)
            },
            message: 'Concept explanation generated successfully'
        });

    } catch (error) {
        next(error);
    }

};


// @desc    Get chat history sessions for a document
// @route   GET /api/ai/chat-history/:documentId
// @access  Private
export const getChatHistory = async (req, res, next) => {
    try {
        const { documentId } = req.params;

        if (!documentId) {
            return res.status(400).json({ success: false, error: 'Document ID is required', statusCode: 400 });
        }

        const chatSessions = await ChatHistory.find({
            userId: req.user._id,
            documentId: documentId
        }).select('_id title pinned updatedAt').sort({ pinned: -1, updatedAt: -1 });

        res.status(200).json({
            success: true,
            data: chatSessions,
            message: 'Chat history retrieved successfully'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get specific chat session by ID
// @route   GET /api/ai/chat/:chatId
// @access  Private
export const getChatSessionById = async (req, res, next) => {
    try {
        const { chatId } = req.params;

        const chatHistory = await ChatHistory.findOne({
            _id: chatId,
            userId: req.user._id
        });

        if (!chatHistory) {
            return res.status(404).json({ success: false, error: 'Chat session not found', statusCode: 404 });
        }

        res.status(200).json({
            success: true,
            data: chatHistory.messages,
            title: chatHistory.title,
            pinned: chatHistory.pinned,
            message: 'Chat session retrieved successfully'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update chat session (rename or pin)
// @route   PUT /api/ai/chat/:chatId
// @access  Private
export const updateChatSession = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const { title, pinned } = req.body;

        const chatHistory = await ChatHistory.findOne({
            _id: chatId,
            userId: req.user._id
        });

        if (!chatHistory) {
            return res.status(404).json({ success: false, error: 'Chat session not found', statusCode: 404 });
        }

        if (title !== undefined) chatHistory.title = title;
        if (pinned !== undefined) chatHistory.pinned = pinned;

        await chatHistory.save();

        res.status(200).json({
            success: true,
            data: { _id: chatHistory._id, title: chatHistory.title, pinned: chatHistory.pinned },
            message: 'Chat session updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete chat session
// @route   DELETE /api/ai/chat/:chatId
// @access  Private
export const deleteChatSession = async (req, res, next) => {
    try {
        const { chatId } = req.params;

        const result = await ChatHistory.deleteOne({
            _id: chatId,
            userId: req.user._id
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, error: 'Chat session not found', statusCode: 404 });
        }

        res.status(200).json({
            success: true,
            message: 'Chat session deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};
