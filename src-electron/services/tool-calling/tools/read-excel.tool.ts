/**
 * Read Excel Tool
 * Reads the contents of a Microsoft Excel (.xlsx) file and extracts text data
 */

import type { ITool, ToolContext } from './base-tool.js';
import type { ToolDefinition, ToolResult, ReadExcelResult } from '../tool-types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import log from 'electron-log';

export class ReadExcelTool implements ITool {
  constructor(private context: ToolContext) {}

  getName(): string {
    return 'read_excel';
  }

  getDefinition(): ToolDefinition {
    return {
      name: 'read_excel',
      description:
        'Read the contents of a Microsoft Excel (.xlsx) file and extract data as text. Only supports .xlsx format (not legacy .xls files). Returns data from all sheets in CSV format.',
      input_schema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description:
              'Path to the .xlsx file (can be relative to working directory or absolute)',
          },
          sheet_name: {
            type: 'string',
            description:
              'Optional: Specific sheet name to read. If not provided, all sheets will be read.',
          },
        },
        required: ['file_path'],
      },
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const userPath = params.file_path as string;
    const sheetName = params.sheet_name as string | undefined;
    const resolvedPath = this.context.service.resolvePath(userPath);

    // Security check
    const pathCheck = this.context.service.checkPathAccess(resolvedPath);
    if (!pathCheck.allowed) {
      return {
        success: false,
        error:
          pathCheck.reason === 'blacklist'
            ? `The file ${userPath} is in a folder I cannot access. I am not allowed to access folders and files in system and sensitive folders.`
            : `I cannot read file ${userPath}. To allow this, add an entry to the allowed folder list in settings.`,
      };
    }

    // Check existence
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        error: `FILE_NOT_FOUND: '${userPath}' does not exist`,
      };
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const stats = await fs.promises.stat(resolvedPath);
    if (!stats.isFile()) {
      return {
        success: false,
        error: `NOT_A_FILE: '${userPath}' is not a file`,
      };
    }

    // Check file extension
    const ext = path.extname(resolvedPath).toLowerCase();
    if (ext !== '.xlsx') {
      if (ext === '.xls') {
        return {
          success: false,
          error: `UNSUPPORTED_FORMAT: Legacy .xls format is not supported. Please convert to .xlsx format.`,
        };
      }
      return {
        success: false,
        error: `INVALID_FILE_TYPE: Expected .xlsx file, got ${ext}`,
      };
    }

    // Check file size (max 100MB for Excel files)
    const maxFileSize = 100 * 1024 * 1024;
    if (stats.size > maxFileSize) {
      return {
        success: false,
        error: `FILE_TOO_LARGE: File is ${(stats.size / 1024 / 1024).toFixed(2)}MB (max: ${maxFileSize / 1024 / 1024}MB)`,
      };
    }

    try {
      // Read the Excel file
      const workbook = XLSX.readFile(resolvedPath);

      const sheets: Array<{
        name: string;
        content: string;
        rowCount: number;
        columnCount: number;
      }> = [];
      let totalRows = 0;
      let totalCells = 0;

      // If specific sheet requested, validate it exists
      if (sheetName && !workbook.SheetNames.includes(sheetName)) {
        return {
          success: false,
          error: `SHEET_NOT_FOUND: Sheet '${sheetName}' not found. Available sheets: ${workbook.SheetNames.join(', ')}`,
        };
      }

      // Process sheets
      const sheetsToProcess = sheetName ? [sheetName] : workbook.SheetNames;

      for (const name of sheetsToProcess) {
        // eslint-disable-next-line security/detect-object-injection
        const sheet = workbook.Sheets[name];
        if (!sheet) continue;

        // Convert to CSV
        const csvContent = XLSX.utils.sheet_to_csv(sheet);

        // Get sheet dimensions
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        const rowCount = range.e.r - range.s.r + 1;
        const columnCount = range.e.c - range.s.c + 1;

        sheets.push({
          name,
          content: csvContent,
          rowCount,
          columnCount,
        });

        totalRows += rowCount;
        totalCells += rowCount * columnCount;
      }

      // Build combined content with sheet separators
      let combinedContent = '';
      for (const sheet of sheets) {
        if (sheets.length > 1) {
          combinedContent += `\n=== Sheet: ${sheet.name} ===\n`;
        }
        combinedContent += sheet.content;
        if (sheets.length > 1) {
          combinedContent += '\n';
        }
      }

      const excelResult: ReadExcelResult = {
        path: resolvedPath,
        content: combinedContent.trim(),
        metadata: {
          size: stats.size,
          modified: stats.mtimeMs,
          sheetCount: sheets.length,
          totalRows,
          totalCells,
          format: 'xlsx',
        },
        sheets: sheets.map((s) => ({
          name: s.name,
          rowCount: s.rowCount,
          columnCount: s.columnCount,
        })),
      };

      return {
        success: true,
        data: excelResult,
      };
    } catch (error) {
      log.error('[ReadExcelTool] Error reading Excel file:', error);
      const err = error as Error;
      return {
        success: false,
        error: `EXTRACTION_ERROR: Failed to read Excel file: ${err.message}`,
      };
    }
  }
}

export function createReadExcelTool(context: ToolContext): ReadExcelTool {
  return new ReadExcelTool(context);
}
