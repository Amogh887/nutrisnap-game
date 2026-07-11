// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AnalysisResults from '../components/AnalysisResults.jsx';

function baseRecipe(overrides = {}) {
  return {
    name: 'Egg Sandwich',
    description: 'Quick and tasty.',
    servings: '1',
    ingredients_used: ['2 eggs'],
    additional_ingredients: [],
    instructions: ['Fry the eggs.'],
    nutrition: {
      calories_kcal: '350',
      protein_g: '20',
      carbs_g: '30',
      fat_g: '15',
    },
    health_score: '7',
    health_explanation: 'Balanced macros.',
    diet_tags: ['high-protein'],
    estimated_time_minutes: '10',
    youtube_query: 'how to make an egg sandwich',
    ...overrides,
  };
}

function noop() {}

describe('AnalysisResults score preview and backward compat', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a points pill when points_estimate is present', () => {
    const data = {
      detected_ingredients: ['egg', 'bread'],
      recipes: [baseRecipe({ points_estimate: 46, difficulty: 4, stretch: 3 })],
    };
    render(
      <AnalysisResults
        data={data}
        onReset={noop}
        onSaveRecipe={noop}
        savedRecipeIds={{}}
        user={null}
        onRequireAuth={noop}
        onPendingCookChange={noop}
        onScanSubmitNow={noop}
        onScanCookFirst={noop}
      />
    );

    expect(screen.getByText('~46 pts')).toBeInTheDocument();
    expect(screen.getByText('difficulty 4')).toBeInTheDocument();
    expect(screen.getByText('stretch 3')).toBeInTheDocument();
    expect(screen.getByText(/Points shown are estimates/)).toBeInTheDocument();
  });

  it('does not render a points pill or difficulty/stretch chips when the fields are absent (old saved recipes)', () => {
    const data = {
      detected_ingredients: [],
      recipes: [baseRecipe()],
    };
    render(
      <AnalysisResults
        data={data}
        onReset={noop}
        onSaveRecipe={noop}
        savedRecipeIds={{}}
        user={null}
        onRequireAuth={noop}
        onPendingCookChange={noop}
        onScanSubmitNow={noop}
        onScanCookFirst={noop}
      />
    );

    expect(screen.queryByText(/~\d+ pts/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^difficulty /)).not.toBeInTheDocument();
    expect(screen.queryByText(/^stretch /)).not.toBeInTheDocument();
    expect(screen.queryByText(/Points shown are estimates/)).not.toBeInTheDocument();
    expect(screen.getByText('Egg Sandwich')).toBeInTheDocument();
  });

  it('hides the detected-ingredients section entirely when the list is empty', () => {
    const data = {
      detected_ingredients: [],
      recipes: [baseRecipe()],
    };
    render(
      <AnalysisResults
        data={data}
        onReset={noop}
        onSaveRecipe={noop}
        savedRecipeIds={{}}
        user={null}
        onRequireAuth={noop}
        onPendingCookChange={noop}
        onScanSubmitNow={noop}
        onScanCookFirst={noop}
      />
    );

    expect(screen.queryByText('Detected ingredients')).not.toBeInTheDocument();
  });

  it('shows the detected-ingredients section when the list is non-empty', () => {
    const data = {
      detected_ingredients: ['egg', 'bread'],
      recipes: [baseRecipe()],
    };
    render(
      <AnalysisResults
        data={data}
        onReset={noop}
        onSaveRecipe={noop}
        savedRecipeIds={{}}
        user={null}
        onRequireAuth={noop}
        onPendingCookChange={noop}
        onScanSubmitNow={noop}
        onScanCookFirst={noop}
      />
    );

    expect(screen.getByText('Detected ingredients')).toBeInTheDocument();
    expect(screen.getByText('egg')).toBeInTheDocument();
    expect(screen.getByText('bread')).toBeInTheDocument();
  });

  it('shows the fiber nutrition cell with a g suffix when fiber_g is present', async () => {
    const data = {
      detected_ingredients: [],
      recipes: [
        baseRecipe({
          nutrition: { calories_kcal: '350', protein_g: '20', carbs_g: '30', fat_g: '15', fiber_g: '6' },
        }),
      ],
    };
    render(
      <AnalysisResults
        data={data}
        onReset={noop}
        onSaveRecipe={noop}
        savedRecipeIds={{}}
        user={null}
        onRequireAuth={noop}
        onPendingCookChange={noop}
        onScanSubmitNow={noop}
        onScanCookFirst={noop}
      />
    );

    const user = (await import('@testing-library/user-event')).default.setup();
    await user.click(screen.getByRole('button', { name: /Show full recipe/ }));

    expect(screen.getByText('6g')).toBeInTheDocument();
    expect(screen.getByText('Fiber')).toBeInTheDocument();
  });

  it('hides the fiber nutrition cell when fiber_g is absent', async () => {
    const data = {
      detected_ingredients: [],
      recipes: [baseRecipe()],
    };
    render(
      <AnalysisResults
        data={data}
        onReset={noop}
        onSaveRecipe={noop}
        savedRecipeIds={{}}
        user={null}
        onRequireAuth={noop}
        onPendingCookChange={noop}
        onScanSubmitNow={noop}
        onScanCookFirst={noop}
      />
    );

    const user = (await import('@testing-library/user-event')).default.setup();
    await user.click(screen.getByRole('button', { name: /Show full recipe/ }));

    expect(screen.queryByText('Fiber')).not.toBeInTheDocument();
  });

  it('renders nothing when data is null', () => {
    const { container } = render(
      <AnalysisResults
        data={null}
        onReset={noop}
        onSaveRecipe={noop}
        savedRecipeIds={{}}
        user={null}
        onRequireAuth={noop}
        onPendingCookChange={noop}
        onScanSubmitNow={noop}
        onScanCookFirst={noop}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
