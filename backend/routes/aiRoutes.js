import express from 'express';

import{
    generateFlashcards,
    generateQuiz,
    generateSummary,
    chat,
    explainConcept,
    getChatHistory,
    getChatSessionById,
    updateChatSession,
    deleteChatSession,
}from '../controllers/aiController.js';
import protect from '../middleware/auth.js';


const router=express.Router();

router.use(protect);

router.post('/generate-flashcards',generateFlashcards);
router.post('/generate-quiz',generateQuiz);
router.post('/generate-summary',generateSummary);
router.post('/chat',chat);
router.post('/explain-concept',explainConcept);
router.get('/chat-history/:documentId',getChatHistory);
router.get('/chat/:chatId', getChatSessionById);
router.put('/chat/:chatId', updateChatSession);
router.delete('/chat/:chatId', deleteChatSession);

export default router;