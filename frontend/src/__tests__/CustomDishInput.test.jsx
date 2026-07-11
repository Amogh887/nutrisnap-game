// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import CustomDishInput from '../components/CustomDishInput.jsx';

describe('CustomDishInput', () => {
  afterEach(() => {
    cleanup();
  });

  it('calls onGenerate with the trimmed dish name when the button is clicked', async () => {
    const onGenerate = vi.fn();
    const ue = userEvent.setup();
    render(<CustomDishInput onGenerate={onGenerate} isLoading={false} error={null} />);

    await ue.type(screen.getByLabelText('Dish name'), '  egg sandwiches  ');
    await ue.click(screen.getByRole('button', { name: /Generate recipe/ }));

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate).toHaveBeenCalledWith('egg sandwiches');
  });

  it('calls onGenerate when Enter is pressed in the input', async () => {
    const onGenerate = vi.fn();
    const ue = userEvent.setup();
    render(<CustomDishInput onGenerate={onGenerate} isLoading={false} error={null} />);

    await ue.type(screen.getByLabelText('Dish name'), 'risotto{Enter}');

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate).toHaveBeenCalledWith('risotto');
  });

  it('does not call onGenerate when the input is empty or whitespace-only', async () => {
    const onGenerate = vi.fn();
    const ue = userEvent.setup();
    render(<CustomDishInput onGenerate={onGenerate} isLoading={false} error={null} />);

    expect(screen.getByRole('button', { name: /Generate recipe/ })).toBeDisabled();

    await ue.type(screen.getByLabelText('Dish name'), '   ');
    expect(screen.getByRole('button', { name: /Generate recipe/ })).toBeDisabled();

    await ue.click(screen.getByRole('button', { name: /Generate recipe/ }));
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('shows a loading state and disables input and button while isLoading is true', () => {
    render(<CustomDishInput onGenerate={vi.fn()} isLoading={true} error={null} />);

    expect(screen.getByText('Generating…')).toBeInTheDocument();
    expect(screen.getByLabelText('Dish name')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Generating…/ })).toBeDisabled();
  });

  it('renders the error banner when an error is passed', () => {
    render(<CustomDishInput onGenerate={vi.fn()} isLoading={false} error="Could not generate a recipe." />);

    expect(screen.getByText('Could not generate a recipe.')).toBeInTheDocument();
  });

  it('renders no error banner when error is null', () => {
    render(<CustomDishInput onGenerate={vi.fn()} isLoading={false} error={null} />);

    expect(screen.queryByText(/Could not generate/)).not.toBeInTheDocument();
  });
});
