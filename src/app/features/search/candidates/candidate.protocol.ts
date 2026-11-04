/**
 * Mensajes entre el hilo principal y el Web Worker. El id permite descartar
 * respuestas que llegan tarde, cuando el usuario ya escribió otra cosa.
 */
export interface Candidate {
  expression: string;
  region: string;
}

export interface CandidateRequest {
  id: number;
  text: string;
}

export interface CandidateResponse {
  id: number;
  candidates: Candidate[];
}
