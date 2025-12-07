export const en = {
  // App
  appName: "Nano Manana",

  // Navigation
  nav: {
    colorize: "Colorize",
    translate: "Translate",
  },

  // Theme
  theme: {
    light: "Light mode",
    dark: "Dark mode",
    toggle: "Toggle theme",
  },

  // Home page
  home: {
    hero: "Colorize and translate manga with Nano Banana pro.",
    colorizeCard: {
      title: "Colorize",
      description: "Add vibrant colors to black and white manga pages",
    },
    translateCard: {
      title: "Translate",
      description: "Translate manga text to different languages",
    },
  },

  // File upload
  upload: {
    title: "Drop your images here",
    subtitle: "or click to browse",
    formats: "Supports PNG, JPG, JPEG, WebP",
  },

  // Sidebar
  sidebar: {
    apiKey: "API Key",
    apiKeyPlaceholder: "Enter your Gemini API key",
    batchSize: "Batch Size",
    resolution: "Resolution",
    fromLanguage: "From Language",
    toLanguage: "To Language",
    fromPlaceholder: "Japanese",
    toPlaceholder: "English",
  },

  // Actions
  actions: {
    colorize: "Colorize!",
    translate: "Translate!",
    processing: "Processing...",
    download: "Download Zip",
    clear: "Clear All",
  },

  // Sorting
  sort: {
    aToZ: "A → Z",
    zToA: "Z → A",
    nameAsc: "Name (A-Z)",
    nameDesc: "Name (Z-A)",
  },

  // Status
  status: {
    pending: "Pending",
    processing: "Processing",
    done: "Done",
  },

  // Resolution options
  resolutions: {
    "1k": "1K",
    "2k": "2K",
    "3k": "3K",
    "4k": "4K",
  },

  // Error messages
  errors: {
    quotaExceeded: "API quota exceeded. Please wait or check your billing.",
    rateLimited: "Too many requests. Please wait {seconds} seconds.",
    invalidApiKey: "Invalid API key. Please check your API key.",
    networkError: "Network error. Please check your connection.",
    serverError: "Server error. Please try again later.",
    noImageGenerated: "No image was generated. Please try again.",
    unknownError: "An unexpected error occurred.",
  },
} as const;

export type TranslationKeys = typeof en;
