// Hand-written mirrors of the backend Pydantic models (see backend/models/, backend/routers/).
// Nothing infers across the Python boundary — keep these in sync in the same edit as the model.

export type Role = "student" | "teacher" | "admin";

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  role: Role;
  plan: string;
  subscribed: boolean;
  subscription_end: string | null;
  created_at: string;
}

export interface UserCard {
  id: string;
  name: string;
  role: Role;
  plan: string;
  subscribed: boolean;
  online: boolean;
  last_active: string | null;
}

export interface ActiveSession {
  session_id: string;
  user: UserPublic;
  login_at: string;
  last_active: string;
  online: boolean;
  user_agent: string;
}

export interface SubmissionBrief {
  id: string;
  status: "submitted" | "graded";
  grade: number | null;
  feedback: string | null;
  submitted_at: string | null;
  filename: string | null;
}

export interface SubmissionFull extends SubmissionBrief {
  homework_id: string;
  student_id: string;
  student_name: string;
  size: number;
  graded_at: string | null;
}

export interface HomeworkItem {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  created_by_name: string;
  created_at: string;
  my_submission: SubmissionBrief | null;
  submission_count: number;
  graded_count: number;
}

export interface HomeworkDetail extends HomeworkItem {
  submissions: SubmissionFull[];
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  points: number;
  correct_index: number | null;
}

export interface AttemptBrief {
  id: string;
  status: "in_progress" | "submitted";
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  auto_submitted: boolean;
}

export type ExamStatus = "scheduled" | "live" | "ended";

export interface ExamItem {
  id: string;
  title: string;
  subject: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  status: ExamStatus;
  question_count: number;
  total_points: number;
  created_by_name: string;
  my_status: string | null;
  my_score: number | null;
}

export interface ExamDetail extends ExamItem {
  questions: Question[];
  my_attempt: AttemptBrief | null;
}

export interface ExamResult {
  score: number;
  total: number;
  auto_submitted: boolean;
  submitted_at: string;
  breakdown: { question_id: string; answer: number | null; correct: boolean }[];
  questions: Question[];
  answers: Record<string, number>;
}

export interface AttemptRow {
  attempt_id: string;
  student_id: string;
  student_name: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total: number;
  auto_submitted: boolean;
}

export interface TutorialStep {
  title: string;
  description: string;
  viz: "sorting" | "graph" | "projectile" | "cards";
}

export interface Tutorial {
  id: string;
  title: string;
  subject: string;
  kind: "animated" | "youtube";
  youtube_id: string | null;
  steps: TutorialStep[];
  created_by_name: string;
  created_at: string;
}

export interface ConversationItem {
  id: string;
  type: "dm" | "group";
  name: string;
  members: { id: string; name: string; role: Role; online: boolean }[];
  last_message: { text: string; sender_name: string; created_at: string } | null;
  unread: number;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: Role;
  text: string;
  created_at: string;
}

export interface Plan {
  lookup_key: string;
  name: string;
  role: Role;
  plan_id: string;
  amount: number;
  currency: string;
  interval: string;
  features: string[];
}

export interface CheckoutResponse {
  session_id: string;
  demo: boolean;
  plan_name: string;
  plan_id: string;
  subscription_end: string;
}

export interface Transaction {
  session_id: string;
  lookup_key: string;
  plan_name: string;
  amount: number;
  currency: string;
  status: string;
  payment_status: string;
  created_at: string;
}
