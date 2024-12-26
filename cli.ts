import { Command } from '@cliffy/command';
import { Table } from '@cliffy/table';
import { colors } from '@cliffy/ansi/colors';
import GptFilesClient from './client.ts';
import type { Assistant, VectorStoreFile } from './client.ts';

await new Command()
  .name('gpt-files')
  .version('0.0.9')
  .description('Manage vector store files for OpenAI assistant')
  .globalEnv(
    'OPENAI_API_KEY=<value:string>',
    'OpenAI api key',
    { required: true },
  )
  .globalEnv(
    'OPENAI_ASSISTANT_ID=<value:string>',
    'OpenAI assistant id. Required for file operation commands',
    { required: false },
  )
  .globalOption('--verbose <value:boolean>', '', {
    default: false,
  })
  .command('create-assistant', 'Create a new assistant.')
  .option(
    '-n, --name <name:string>',
    'Name of the assistant',
    { required: true },
  )
  .option(
    '-m, --model <model:string>',
    'Model for the assistant',
    { required: true },
  )
  .option(
    '-d, --description <description:string>',
    'Description of the assistant',
    { required: false },
  )
  .option(
    '-i, --instructions <instructions:string>',
    'Instructions for the assistant',
    { required: false },
  )
  .action(async (options) => {
    try {
      const client = new GptFilesClient(
        options.openaiApiKey,
      );
      const a = await client.createAssistant(options);
      console.log(
        colors.green('✓'),
        'Assistant created successfully:',
        '\n',
        JSON.stringify(a, null, 2),
      );
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('update-assistant', 'Update an assistant')
  .arguments('<assistantId:string>')
  .option(
    '-n, --name <name:string>',
    'Name of the assistant',
    { required: false },
  )
  .option(
    '-m, --model <model:string>',
    'Model for the assistant',
    { required: false },
  )
  .option(
    '-d, --description <description:string>',
    'Description of the assistant',
    { required: false },
  )
  .option(
    '-i, --instructions <instructions:string>',
    'Instructions for the assistant',
    { required: false },
  )
  .action(async (options, assistantId) => {
    try {
      const client = new GptFilesClient(
        options.openaiApiKey,
      );
      const a = await client.updateAssistant(assistantId, options);
      console.log(
        colors.green('✓'),
        'Assistant updated successfully:',
        '\n',
        JSON.stringify(a, null, 2),
      );
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('del-assistant', 'Delete an assistant')
  .arguments('<assistantId:string>')
  .action(async (options, assistantId) => {
    try {
      const client = new GptFilesClient(
        options.openaiApiKey,
      );
      await client.deleteAssistant(assistantId);
      console.log(colors.green('✓'), 'Assistant deleted successfully');
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('assistant', 'Show the details of an assistant')
  .arguments('<assistantId:string>')
  .action(async (options, assistantId) => {
    try {
      const client = new GptFilesClient(
        options.openaiApiKey,
      );
      const assistant = await client.assistant(assistantId);
      console.log(JSON.stringify(assistant, null, 2));
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('assistants', 'List all assistants')
  .action(async (options) => {
    try {
      const client = new GptFilesClient(
        options.openaiApiKey,
      );
      const assistants = await client.listAssistants();
      const table = new Table()
        .header(['ID', 'Name', 'Description', 'Model'])
        .body(
          assistants.map((a: Assistant) => [
            a.id,
            a.name,
            a.description,
            a.model,
          ]),
        ).border(true).maxColWidth(30);

      table.render();
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('upload', 'Upload a file to a assistant')
  .option(
    '-n, --new-name <name:string>',
    'New filename to override the original filename',
  )
  .arguments('<filePath:string>')
  .action(async (options, filePath) => {
    try {
      const client = new GptFilesClient(
        options.openaiApiKey,
      );
      const response = await client.uploadFile({
        filePath,
        assistantId: options.openaiAssistantId!,
        newFileName: options.newName,
      });
      console.log(
        colors.green('✓'),
        'File uploaded successfully:',
        response.id,
      );
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('list', 'List all files attached to an assistant')
  .action(async (options) => {
    try {
      const client = new GptFilesClient(
        options.openaiApiKey,
      );
      const files = await client.listFiles(
        options.openaiAssistantId!,
      );

      const table = new Table()
        .header([
          'ID',
          'Object',
          'Size',
          'Created',
          'Vector Store ID',
          'Status',
        ])
        .body(
          files.map((file: VectorStoreFile) => [
            file.id,
            file.object,
            `${(file.usage_bytes / 1024).toFixed(2)} KB`,
            new Date(file.created_at * 1000).toLocaleString(),
            file.vector_store_id,
            file.status,
          ]),
        );

      table.render();
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('delete', 'Remove a file from an assistant')
  .arguments('<fileId:string>')
  .action(async (options, fileId) => {
    try {
      const client = new GptFilesClient(
        options.openaiApiKey,
      );
      await client.removeFile({
        fileId,
        assistantId: options.openaiAssistantId!,
      });
      console.log(colors.green('✓'), 'File deleted successfully');
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .parse(Deno.args);
