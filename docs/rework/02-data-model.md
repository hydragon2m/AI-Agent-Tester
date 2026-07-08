# Data Model

## Project

```text
projects
- id
- name
- context
- stack
- framework
- url
- api_base_url
- tc_prefix
- modules
- created_at
- updated_at
```

## Node

```text
nodes
- id
- project_id
- parent_id
- type: project | module | screen | feature
- name
- context
- sort_order
- created_at
- updated_at
```

## Test Case

```text
test_cases
- id
- node_id
- external_id
- module
- name
- type
- priority
- suite
- automation_candidate
- trace_to
- preconditions
- steps_json
- test_data
- expected_result
- status
- actual_result
- related_bug
- created_at
- updated_at
```

## AI Run

```text
ai_runs
- id
- node_id
- skill
- provider
- prompt
- output
- parsed_output_json
- status
- error_message
- created_at
```

## Snippet

```text
snippets
- id
- title
- content
- tags_json
- created_at
- updated_at
```

## Provider Settings

For single-user internal usage, use environment variables first. If user-managed keys are required later, store them encrypted server-side.

```text
provider_settings
- id
- provider
- encrypted_key
- enabled
- priority
- created_at
- updated_at
```

