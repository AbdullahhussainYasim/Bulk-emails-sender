import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, getMe } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Box, Button, TextField, Typography, Paper, Alert } from '@mui/material';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { loginUser } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await login({ username: email, password });
            const token = response.data.access_token;
            localStorage.setItem('token', token);
            const userResponse = await getMe();
            loginUser(token, userResponse.data);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to login');
        }
    };

    return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor="#f5f5f5">
            <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 400 }}>
                <Typography variant="h5" align="center" gutterBottom fontWeight="bold">
                    Login to Bulk Emailer
                </Typography>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <form onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        label="Email"
                        type="email"
                        margin="normal"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <TextField
                        fullWidth
                        label="Password"
                        type="password"
                        margin="normal"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button
                        fullWidth
                        type="submit"
                        variant="contained"
                        color="primary"
                        sx={{ mt: 3, mb: 2, py: 1.5 }}
                    >
                        Sign In
                    </Button>
                </form>
                <Typography align="center">
                    Don't have an account? <Link to="/register">Register here</Link>
                </Typography>
            </Paper>
        </Box>
    );
};

export default Login;
