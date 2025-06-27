import { simpleParser, ParsedMail, AddressObject } from 'mailparser';

export interface StandardizedEmail {
  id: string;
  messageId: string;
  threadId?: string;
  date: string;
  from: string;
  to: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  attachments: any[];
  headers: Record<string, string>;
}

function extractAddresses(addrObj: AddressObject | AddressObject[] | undefined): string[] {
  if (!addrObj) return [];
  if (Array.isArray(addrObj)) {
    // Defensive: not expected from mailparser, but handle gracefully
    return addrObj.flatMap(obj => Array.isArray(obj.value) ? obj.value.map(v => v.address || '') : []);
  }
  if (Array.isArray((addrObj as AddressObject).value)) {
    return (addrObj as AddressObject).value.map((a: { address?: string }) => a.address || '');
  }
  return [];
}

function stringifyHeaders(headers: Map<string, any>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    if (Array.isArray(value)) {
      result[key] = value.join(', ');
    } else if (typeof value === 'object' && value !== null && 'value' in value) {
      result[key] = String(value.value);
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

export async function parseRawEmail(raw: string | Buffer): Promise<StandardizedEmail> {
  const parsed: ParsedMail = await simpleParser(raw);

  return {
    id: parsed.messageId || '',
    messageId: parsed.messageId || '',
    threadId: parsed.headers.get('thread-index') as string || '',
    date: parsed.date?.toISOString() || '',
    from: parsed.from?.text || '',
    to: extractAddresses(parsed.to),
    subject: parsed.subject || '',
    bodyHtml: parsed.html || '',
    bodyText: parsed.text || '',
    attachments: parsed.attachments || [],
    headers: stringifyHeaders(parsed.headers),
  };
} 