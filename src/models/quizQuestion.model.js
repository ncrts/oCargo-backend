const mongoose = require('mongoose');

/**
 * QuizQuestion Model (ÔCargo App)
 *
 * Represents a **single question** in a quiz.
 * Each question can have a unique format, timer, media, and answer type.
 *
 * Supported question types:
 * - `Quiz`: Multiple-choice question (single or multi-select)
 * - `TrueFalse`: Binary question (True or False)
 * - `TypeAnswer`: Free text entry (must match accepted answers)
 * - `Puzzle`: Ordered sequence question (drag-and-drop)
 * - `Slider`: Numeric input (choose a number within a range)
 * - `Slide`: Informational slide (no answer, just content)
 */

const quizQuestionSchema = new mongoose.Schema({
  // ------------------------------------------------
  // 🔹 Core Relationship
  // ------------------------------------------------

  /**
   * 🧩 Quiz Reference
   * Links this question to its parent `Quiz` document.
   */
  quizId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Quiz',
    default: null,
    description: 'Reference to the parent quiz containing this question.'
  },

  /**
   * 🔢 Question Sequence
   * Defines the position/order of this question within its parent quiz.
   * Questions are displayed in ascending sequence order (1, 2, 3, ...).
   */
  sequence: {
    type: Number,
    default: null,
    description: 'Sequence/order number of this question within the quiz (1-based).'
  },

  /**
   * 🏷️ Question Category
   * Reference to the QuizCategory model, linking this question to a category.
   */
  categoryId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'QuizCategory',
    default: null,
    description: 'Reference to the quiz category for this question.'
  },

  // ------------------------------------------------
  // 🔹 Question Type & Text
  // ------------------------------------------------

  /**
   * 🎯 Question Type
   * Defines the format of the question.
   * Determines which answer validation logic is used.
   */
  type: {
    type: String,
    enum: ['Quiz', 'TrueFalse', 'TypeAnswer', 'Puzzle', 'Slider', 'Slide', 'imagePin'],
    default: null,
    description: 'Type of question defining interaction and answer format.'
  },

  /**
   * 📝 Question Text
   * The main question prompt displayed to players.
   */
  questionText: {
    type: String,
    default: null,
    description: 'Primary text displayed as the question prompt.'
  },

  /**
   * 🖼️ Background Image
   * Optional image displayed as the background during the question.
   */
  backgroundImage: {
    type: String,
    default: null,
    description: 'Optional background image displayed during the question.'
  },

  // ------------------------------------------------
  // 🔹 Media Section (Optional)
  // ------------------------------------------------

  /**
   * 🎬 Media
   * Optional media (image or YouTube) attached to the question.
   * Allows integration of images or short YouTube segments.
   */
  media: {
    /**
     * 📺 Media Type
     * Defines whether the media is an image, YouTube video, or none.
     */
    type: {
      type: String,
      enum: ['Image', 'YouTube', 'None'],
      default: 'None',
      description: 'Specifies the type of media attached to this question.'
    },

    /**
     * 🖼️ Image URL
     * Link to an image file if `type` is "Image".
     */
    image: {
      type: String,
      default: null,
      description: 'Image URL for media display (if applicable).'
    },

    /**
     * ▶️ YouTube Video
     * ID of the embedded YouTube video.
     */
    youtubeId: {
      type: String,
      default: null,
      description: 'YouTube video ID used for embedding media.'
    },

    /**
     * ⏱️ YouTube Start Time
     * Start time in seconds for video playback.
     */
    youtubeStart: {
      type: Number,
      default: null,
      description: 'Start time (in seconds) for YouTube video playback.'
    },

    /**
     * ⏹️ YouTube End Time
     * End time in seconds for video playback.
     */
    youtubeEnd: {
      type: Number,
      default: null,
      description: 'End time (in seconds) for YouTube video playback.'
    }
  },

  // ------------------------------------------------
  // 🔹 Multiple Choice / Puzzle Options
  // ------------------------------------------------

  /**
   * 🧠 Options
   * List of possible answers (used in Quiz & Puzzle types).
   * Each option includes text, optional image, and correctness flag.
   */
  options: [{
    /**
     * Text for the option (e.g., "Paris", "Einstein").
     */
    text: {
      type: String,
      description: 'Displayed text of the option.'
    },

    /**
     * Optional image for visual options.
     */
    image: {
      type: String,
      default: null,
      description: 'Optional image URL for the answer option.'
    },

    /**
     * Boolean flag indicating whether this option is correct.
     */
    isCorrect: {
      type: Boolean,
      default: false,
      description: 'Marks this option as correct (true) or incorrect (false).'
    }
  }],

  /**
   * ✅ Multi-Select Option
   * When true, players can select multiple correct answers.
   */
  multiSelect: {
    type: Boolean,
    default: false,
    description: 'Allows multiple correct selections (for Quiz type).'
  },

  // ------------------------------------------------
  // 🔹 True / False Type
  // ------------------------------------------------

  /**
   * 🔘 True/False Answer
   * Boolean answer for True/False question types.
   */
  trueAnswer: {
    type: Boolean,
    default: null,
    description: 'Correct boolean answer for True/False questions.'
  },

  // ------------------------------------------------
  // 🔹 TypeAnswer (Text Input)
  // ------------------------------------------------

  /**
   * ✍️ Accepted Answers
   * Array of acceptable text responses for open-ended questions.
   * Comparisons are case-insensitive and trimmed.
   */
  acceptedAnswers: [{
    type: String,
    description: 'List of valid text answers (case-insensitive matching).'
  }],

  // ------------------------------------------------
  // 🔹 Puzzle (Order-based)
  // ------------------------------------------------

  /**
   * 🧩 Puzzle Order
   * Defines the correct sequence of elements for puzzle-type questions.
   * Example: ["Step 1", "Step 2", "Step 3"]
   */
  puzzleOrder: [{
    type: String,
    description: 'Defines the correct order for puzzle-type questions.'
  }],

  // ------------------------------------------------
  // 🔹 Slider (Numeric Input)
  // ------------------------------------------------

  /**
   * 🎚️ Slider Configuration
   * Defines the range and correct range for slider-type questions.
   */
  slider: {
    /**
     * Minimum slider value.
     */
    min: {
      type: Number,
      default: null,
      description: 'Minimum value allowed on the slider.'
    },

    /**
     * Maximum slider value.
     */
    max: {
      type: Number,
      default: null,
      description: 'Maximum value allowed on the slider.'
    },

    step: {
      type: Number,
      default: 1,
      description: 'Step value for the slider.'
    },

    /**
     * Correct range of values (e.g., [45, 50] for correct answers).
     */
    correctRange: {
      type: Number,
      default: null,
      description: 'acceptable answer value between range (min and max).'
    }
  },

  // ------------------------------------------------
  // 🔹 Slide Type (Informational)
  // ------------------------------------------------

  /**
   * 🖼️ Slide Content
   * Used for informational or transition slides (no question or scoring).
   */
  slideContent: {
    /**
     * Title text of the slide.
     */
    title: {
      type: String,
      default: null,
      description: 'Title displayed on informational slides.'
    },

    /**
     * Main body text of the slide.
     */
    text: {
      type: String,
      default: null,
      description: 'Supporting text displayed on the slide.'
    },

    /**
     * Optional image for visual slides.
     */
    image: {
      type: String,
      default: null,
      description: 'Optional image displayed on the slide.'
    },

    /**
     * Optional video for dynamic slides.
     */
    video: {
      type: String,
      default: null,
      description: 'Optional video link for slide display.'
    },

    /**
     * Duration (in seconds) before automatically moving to next slide.
     */
    duration: {
      type: Number,
      default: 5,
      description: 'How long (in seconds) the slide remains visible.'
    }
  },

  // ------------------------------------------------
  // 🔹 Explanation (After Answer Reveal)
  // ------------------------------------------------

  /**
   * 💡 Explanation
   * Provides educational feedback or clarification after revealing the correct answer.
   * Can include text, image, or YouTube video segment.
   */
  explanation: {
    /**
     * Text-based explanation.
     */
    text: {
      type: String,
      default: null,
      description: 'Text explanation for the answer.'
    },

    /**
     * Optional illustrative image.
     */
    image: {
      type: String,
      default: null,
      description: 'Image to support the explanation.'
    },

    /**
     * YouTube video ID for video-based explanations.
     */
    youtubeId: {
      type: String,
      default: null,
      description: 'YouTube video ID used for explanation media.'
    },

    /**
     * Start and end times for video explanation playback.
     */
    youtubeStart: {
      type: Number,
      default: null,
      description: 'Start time for video explanation (in seconds).'
    },
    youtubeEnd: {
      type: Number,
      default: null,
      description: 'End time for video explanation (in seconds).'
    }
  },

  imagePinFile: {
    type: String,
    default: null,
    description: 'File path or URL for the image pin.'
  },

  imagePinArrObj: [{
    polygonCoordinates: [{
      xAxis: {
        type: Number,
        default: null,
        description: 'X-axis coordinate for polygon point.'
      },
      yAxis: {
        type: Number,
        default: null,
        description: 'Y-axis coordinate for polygon point.'
      }
    }]
  }],

  // ------------------------------------------------
  // 🔹 Timing & Difficulty
  // ------------------------------------------------

  /**
   * ⏰ Time Limit
   * Maximum duration (in seconds) players have to answer this question.
   */
  timeLimit: {
    type: Number,
    default: 30,
    description: 'Time limit to answer the question (in seconds).'
  },

  /**
   * 💪 Difficulty Level
   * Indicates question complexity (used in XP calculation and analytics).
   */
  difficaltyLavel: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard', 'VeryHard'],
    default: 'Easy',
    description: 'Difficulty level of the question.'
  },

  maxScore: {
    type: Number,
    default: 100,
    description: 'Maximum score achievable for this question.'
  },
  
  // ------------------------------------------------
  // 🔹 Metadata
  // ------------------------------------------------

  /**
   * 🕒 Created Timestamp
   * Automatically records when the question was created.
   */
  createdAt: {
    type: Date,
    default: Date.now,
    description: 'Timestamp when this question was created.'
  },

  numberOfAttempts: {
    type: Number,
    default: 0,
    description: 'Total number of attempts made on this question.'
  },
  numberOfCorrectAttempts: {
    type: Number,
    default: 0,
    description: 'Total number of correct attempts on this question.'
  }
  
});

module.exports = mongoose.model('QuizQuestion', quizQuestionSchema);
