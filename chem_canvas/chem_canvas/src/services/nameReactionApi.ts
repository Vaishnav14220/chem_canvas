const HF_API_URL = 'https://smitathkr1-namereaction-api.hf.space/api/predict';

interface GradioResponse<T> {
  data?: T[];
  is_generating?: boolean;
  duration?: number;
  average_duration?: number;
  queued?: number;
  error?: string;
}

class NameReactionApiError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'NameReactionApiError';
  }
}

const callNameReactionApi = async <T>(fnIndex: number, payload: unknown[]): Promise<T> => {
  try {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fn_index: fnIndex,
        data: payload
      })
    });

    if (!response.ok) {
      throw new NameReactionApiError(`API request failed with status ${response.status}`);
    }

    const json = (await response.json()) as GradioResponse<T>;

    if (json.error) {
      throw new NameReactionApiError(json.error);
    }

    if (!json.data || json.data.length === 0) {
      throw new NameReactionApiError('No data returned from Name Reaction API.');
    }

    return json.data[0];
  } catch (error) {
    if (error instanceof NameReactionApiError) {
      throw error;
    }

    throw new NameReactionApiError('Failed to communicate with Name Reaction API.', error);
  }
};

export const searchReactionByName = async (query: string): Promise<string> => {
  return callNameReactionApi<string>(0, [query]);
};

export const searchReactionByReactant = async (reactant: string): Promise<string> => {
  return callNameReactionApi<string>(1, [reactant]);
};

export const searchReactionByProduct = async (product: string): Promise<string> => {
  return callNameReactionApi<string>(2, [product]);
};

export const autocompleteReactionNames = async (query: string): Promise<string[]> => {
  return callNameReactionApi<string[]>(3, [query]);
};

export const autocompleteReactants = async (query: string): Promise<string[]> => {
  return callNameReactionApi<string[]>(4, [query]);
};

export const autocompleteProducts = async (query: string): Promise<string[]> => {
  return callNameReactionApi<string[]>(5, [query]);
};

export const generateReactionSvg = async (name: string): Promise<string> => {
  return callNameReactionApi<string>(6, [name]);
};

export const downloadAllReactionsPdf = async (): Promise<string> => {
  return callNameReactionApi<string>(7, []);
};

export { NameReactionApiError };
