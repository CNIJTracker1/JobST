export const PIPELINE = ["Bookmarked", "Applying", "Applied", "Interviewed", "Offered"];
export const ALL_STATUSES = [...PIPELINE, "Archived", "Deleted"];

/** Status colors ported from kanban_board_screen.dart (soft bg + strong accent). */
export const STATUS_META = {
  Bookmarked: { color: "#1976D2", soft: "#E3F2FD", icon: "Bookmark", hint: "Saved for later" },
  Applying: { color: "#F57C00", soft: "#FFF3E0", icon: "PenLine", hint: "Working on it" },
  Applied: { color: "#7B1FA2", soft: "#F3E5F5", icon: "Send", hint: "Application sent" },
  Interviewed: { color: "#2E7D32", soft: "#E8F5E9", icon: "Mic", hint: "In conversations" },
  Offered: { color: "#C2185B", soft: "#FCE4EC", icon: "Gift", hint: "Offer on the table" },
  Archived: { color: "#607D8B", soft: "#ECEFF1", icon: "Archive", hint: "Concluded" },
  Deleted: { color: "#9E9E9E", soft: "#F5F5F5", icon: "Trash2", hint: "In the bin" },
};

export const ACTION_META = {
  bookmark: { label: "Bookmark", emoji: "🔖" },
  apply: { label: "Apply", emoji: "📮" },
  interview: { label: "Interview", emoji: "🎤" },
  follow_up: { label: "Follow-up", emoji: "⚡" },
  contacts: { label: "Networking", emoji: "👥" },
  research: { label: "Research", emoji: "🔎" },
  accept_offer: { label: "Accept offer", emoji: "🎁" },
};

export const INTERVIEW_TYPES = ["Screening call", "First round", "Second round", "Final round", "Practical", "Other"];
export const DOCUMENT_TYPES = [
  { value: "Resume", label: "Resume" },
  { value: "CoverLetter", label: "Cover letter" },
  { value: "Portfolio", label: "Portfolio" },
  { value: "Other", label: "Other" },
];
export const CONTACT_FORMATS = ["Phone", "Video", "In-Person", "Email"];
export const RELATIONSHIPS = ["Professional", "Recruiter", "Hiring manager", "Mentor", "Friend"];
export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const CAREERNICHE_URL = "https://careerniche.ca";
export const CAREERNICHE_CLUB_URL = "https://careernicheclub.com";
