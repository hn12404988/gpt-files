# gpt-files

## Description

`gpt-files` is a CLI tool for managing resources (`file`, `vector store`, `code`...etc) for OpenAI assistant with ease. It can be easily installed on Linux, macOS, and Windows systems.

## Installation

#### For Linux and macOS
```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Positive-LLC/gpt-files/main/install.sh)"
```

#### For Windows (PowerShell)
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing https://raw.githubusercontent.com/Positive-LLC/gpt-files/main/install.ps1 | Invoke-Expression"
```

## Features

```sh
# Create a new assistant
gpt-files create-assistant -n my-assistant

# Upload a file to the assistant
gpt-files upload ./deno.json

# List all files in the assistant
gpt-files list 
```

## All Commands

To see all the available commands and options, please run `--help`.

```sh
$ gpt-files --help
```

```sh
Commands:

  create-assistant                   - Create a new assistant.                
  update-assistant  <assistantId>    - Update an assistant                    
  del-assistant     <assistantId>    - Delete an assistant                    
  assistant         <assistantId>    - Show the details of an assistant       
  assistants                         - List all assistants                    
  create-store      <name>           - Create a new vector store              
  del-store         <vectorStoreId>  - Delete a vector store                  
  store             <vectorStoreId>  - Show the details of a vector store     
  stores                             - List all vector stores                 
  upload            <filePath>       - Upload a file to a assistant           
  file              <fileId>         - Show the details of a file             
  list                               - List all files attached to an assistant
  delete            <fileId>         - Remove a file from an assistant 
```

For each command, you can run `--help` to see the available options like this.
```sh
$ gpt-files upload --help
```

```sh
Usage:   gpt-files upload <filePath>
Version: 0.0.10                     

Description:

  Upload a file to an assistant

Options:

  -h, --help              - Show this help.                                                 
  --verbose               - Print verbose output                            (Default: false)
  -n, --new-name  <name>  - New filename to override the original filename                  

Environment variables:

  OPENAI_API_KEY       <value>  - OpenAI api key                                             (required)
  OPENAI_ASSISTANT_ID  <value>  - OpenAI assistant id. Required for file operation commands
```