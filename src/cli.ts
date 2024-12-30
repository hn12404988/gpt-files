import { Command } from '@cliffy/command';
import { Table } from '@cliffy/table';
import { colors } from '@cliffy/ansi/colors';
import type { Assistant } from './clients/assistant.ts';
import type { VectorStoreFile } from './clients/vector_store.ts';
import Client from './client.ts';
import AssistantClient from './clients/assistant.ts';

await new Command()
  .name('gpt-files')
  .version('0.0.12')
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
  .globalOption('--verbose', 'Print verbose output', {
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
    'Model for the assistant. Default: "gpt-4o"',
    { required: false, default: 'gpt-4o' },
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
  .option(
    '--no-vector-store',
    'Do not create a vector store for this new assistant',
    { required: false, default: true },
  )
  .action(async (options) => {
    try {
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      const a = await client.newAssistant(options);
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
  .option('--vector-store-id <vectorStoreId:string>', 'Vector store ID', {
    required: false,
  })
  .action(async (options, assistantId) => {
    try {
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      const a = await client.updateAssistant(
        assistantId,
        options,
      );
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
  .option(
    '--include-files <value:boolean>',
    'Delete all files and vector store attached to the assistant',
    { required: true },
  )
  .arguments('<assistantId:string>')
  .action(async (options, assistantId) => {
    try {
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      await client.deleteAssistant(assistantId, options.includeFiles);
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
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      const assistant = await client.getAssistant(assistantId);
      console.log(JSON.stringify(assistant, null, 2));
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('assistants', 'List all assistants')
  .action(async (options) => {
    try {
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      const assistants = await client.listAssistants();
      const table = new Table()
        .header(['ID', 'Name', 'Description', 'Model', 'Vector Store ID'])
        .body(
          assistants.map((a: Assistant) => [
            a.id,
            a.name,
            a.description,
            a.model,
            AssistantClient.tryGetVectorStoreId(a),
          ]),
        ).border(true).maxColWidth(40);

      table.render();
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('create-store', 'Create a new vector store')
  .arguments('<name:string>')
  .action(async (options, name) => {
    try {
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      const store = await client.createVectorStore(name);
      console.log(colors.green('✓'), 'Vector store created:', store.id);
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('del-store', 'Delete a vector store')
  .arguments('<vectorStoreId:string>')
  .action(async (options, vectorStoreId) => {
    try {
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      await client.deleteVectorStore(vectorStoreId);
      console.log(colors.green('✓'), 'Vector store deleted successfully');
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('store', 'Show the details of a vector store')
  .arguments('<vectorStoreId:string>')
  .action(async (options, vectorStoreId) => {
    try {
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      const store = await client.getVectorStore(vectorStoreId);
      console.log(JSON.stringify(store, null, 2));
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('stores', 'List all vector stores')
  .action(async (options) => {
    try {
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      const stores = await client.listVectorStores();
      const table = new Table()
        .header(['ID', 'Name', 'Created'])
        .body(
          stores.map((store) => [
            store.id,
            store.name,
            new Date(store.created_at * 1000).toLocaleString(),
          ]),
        ).border(true).maxColWidth(40);

      table.render();
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('upload', 'Upload a file to an assistant')
  .option(
    '-n, --file-name <name:string>',
    'New filename to override the filename in the file path',
  )
  .option(
    '-o, --overwrite',
    'Overwrite the file if it already exists',
    { default: false },
  )
  .arguments('<filePath:string>')
  .action(async (options, filePath) => {
    try {
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      const response = await client.uploadFile({
        filePath,
        assistantId: options.openaiAssistantId!,
        overwrite: options.overwrite,
        newFileName: options.fileName,
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
  .command('file', 'Show the details of a file')
  .arguments('<fileId:string>')
  .action(async (options, fileId) => {
    try {
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      const file = await client.getFile(fileId);
      console.log(JSON.stringify(file, null, 2));
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command(
    'delete',
    'Detach a file from an assistant and delete it permanently',
  )
  .arguments('<fileId:string>')
  .action(async (options, fileId) => {
    try {
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      await client.detachFile({
        fileId,
        assistantId: options.openaiAssistantId!,
      });
      console.log(colors.green('✓'), 'Detach file successfully');
      await client.deleteFile({ fileId });
      console.log(colors.green('✓'), 'Delete file successfully');
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command(
    'detach',
    'Detach a file from an assistant',
  )
  .arguments('<fileId:string>')
  .action(async (options, fileId) => {
    try {
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      await client.detachFile({
        fileId,
        assistantId: options.openaiAssistantId!,
      });
      console.log(colors.green('✓'), 'Detach file successfully');
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('list', 'List all files attached to an assistant')
  .action(async (options) => {
    try {
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      const files = await client.listVectorStoreFiles(
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
        ).border(true).maxColWidth(40);

      table.render();
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .command('files', 'List all files under your openai account')
  .action(async (options) => {
    try {
      const client = new Client(
        options.openaiApiKey,
        { verbose: options.verbose },
      );
      const files = await client.allFiles();
      const table = new Table()
        .header(['ID', 'Filename', 'Size', 'Created', 'Purpose'])
        .body(
          files.map((file) => [
            file.id,
            file.filename,
            `${(file.bytes / 1024).toFixed(2)} KB`,
            new Date(file.created_at * 1000).toLocaleString(),
            file.purpose,
          ]),
        ).border(true).maxColWidth(40);

      table.render();
    } catch (error: unknown) {
      console.error(colors.red('✗'), 'Error:', error);
      Deno.exit(1);
    }
  })
  .parse(Deno.args);
