import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Categories from './Categories.jsx';

describe('<Categories />', () => {
  it('renders the heading and the full set of shelves', () => {
    render(<Categories />);
    expect(screen.getByText('Find your corner.')).toBeInTheDocument();
    expect(screen.getByText('Fiction')).toBeInTheDocument();
    expect(screen.getByText('Food & Coffee')).toBeInTheDocument();
    expect(screen.getByText('2140 titles')).toBeInTheDocument();
  });
});
