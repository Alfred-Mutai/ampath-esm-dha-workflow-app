interface SGICaptureRequest {
  Timeout: number;
  Quality: number;
  licstr: string;
  templateFormat: 'ISO' | 'ANSI';
}

interface SGICaptureResponse {
  ErrorCode: number;
  Quality: number;
  BMPBase64: string;
  TemplateBase64: string;
  Width: number;
  Height: number;
  MaxTemplateSize: number;
  TemplateSize: number;
}

interface SGIMatchRequest {
  template1: string;
  template2: string;
  templateFormat: 'ISO' | 'ANSI';
}

interface SGIMatchResponse {
  ErrorCode: number;
  MatchingScore: number;
}

interface CaptureResult {
  image: string;
  isoTemplate: string;
  quality: number;
}

interface MatchResult {
  matched: boolean;
  score: number;
}
