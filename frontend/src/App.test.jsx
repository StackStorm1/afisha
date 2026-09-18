import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import App from './App.jsx';

describe('App', () => {
  it('рендерит главную страницу по умолчанию', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(screen.getByRole('heading', { name: 'Stack Afisha' })).toBeInTheDocument();
  });
});
