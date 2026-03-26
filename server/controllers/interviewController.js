const Interview = require('../models/Interview');
const axios = require('axios');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const generateQuestions = async (role, difficulty) => {
    try {
        const prompt = `Generate 5 interview questions for a ${role} position at ${difficulty} level. Return as JSON array with 'question' field.`;
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        const content = response.data.choices[0].message.content;
        return JSON.parse(content);
    } catch (error) {
        console.error('Error generating questions:', error);
        return [];
    }
};

const evaluateAnswer = async (question, answer) => {
    try {
        const prompt = `Evaluate this interview answer:\nQuestion: ${question}\nAnswer: ${answer}\n\nProvide: 1) Score (0-10), 2) Feedback (2-3 sentences), 3) Confidence level (high/medium/low). Return as JSON.`;
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        const content = response.data.choices[0].message.content;
        return JSON.parse(content);
    } catch (error) {
        console.error('Error evaluating answer:', error);
        return { score: 0, feedback: 'Unable to evaluate', confidenceLevel: 'low' };
    }
};

exports.startInterview = async (req, res) => {
    try {
        const { role, difficulty } = req.body;
        const questions = await generateQuestions(role, difficulty);
        const interview = await Interview.create({
            userId: req.user._id,
            role,
            difficulty,
            questions: questions.map(q => ({ question: q.question }))
        });
        res.status(201).json({ success: true, interview });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.submitAnswer = async (req, res) => {
    try {
        const { interviewId, questionIndex, answer } = req.body;
        const interview = await Interview.findById(interviewId);
        if (!interview) {
            return res.status(404).json({ success: false, message: 'Interview not found' });
        }
        const question = interview.questions[questionIndex];
        const evaluation = await evaluateAnswer(question.question, answer);
        interview.questions[questionIndex].userAnswer = answer;
        interview.questions[questionIndex].score = evaluation.score;
        interview.questions[questionIndex].feedback = evaluation.feedback;
        interview.questions[questionIndex].confidenceLevel = evaluation.confidenceLevel;
        interview.totalScore = interview.questions.reduce((acc, q) => acc + (q.score || 0), 0);
        await interview.save();
        res.status(200).json({ success: true, evaluation, totalScore: interview.totalScore });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getInterview = async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id);
        if (!interview) {
            return res.status(404).json({ success: false, message: 'Interview not found' });
        }
        res.status(200).json({ success: true, interview });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getUserInterviews = async (req, res) => {
    try {
        const interviews = await Interview.find({ userId: req.user._id });
        res.status(200).json({ success: true, interviews });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};