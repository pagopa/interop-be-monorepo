#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "pathname"
require "yaml"
require "date"

ROOT = Pathname.new(File.expand_path("..", __dir__))
HTTP_METHODS = %w[get post put patch delete].freeze
PLACEHOLDER_TOKEN = "__BRUNO_VAR__"

PROCESS_SPECS = [
  {
    name: "agreement",
    spec: "packages/api-clients/open-api/agreementApi.yml",
    collection: "collections/agreement",
  },
  {
    name: "attribute",
    spec: "packages/api-clients/open-api/attributeRegistryApi.yml",
    collection: "collections/attribute",
  },
  {
    name: "authorization",
    spec: "packages/api-clients/open-api/authorizationApi.yml",
    collection: "collections/authorization",
  },
  {
    name: "catalog",
    spec: "packages/api-clients/open-api/catalogApi.yml",
    collection: "collections/catalog",
  },
  {
    name: "delegation",
    spec: "packages/api-clients/open-api/delegationApi.yml",
    collection: "collections/delegation",
  },
  {
    name: "eservice-template",
    spec: "packages/api-clients/open-api/eserviceTemplateApi.yml",
    collection: "collections/eservice-template",
  },
  {
    name: "in-app-notification",
    spec: "packages/api-clients/open-api/inAppNotificationApi.yml",
    collection: "collections/in-app-notification",
  },
  {
    name: "notification-config",
    spec: "packages/api-clients/open-api/notificationConfigApi.yml",
    collection: "collections/notification-config",
  },
  {
    name: "purpose",
    spec: "packages/api-clients/open-api/purposeApi.yml",
    collection: "collections/purpose",
  },
  {
    name: "purpose-template",
    spec: "packages/api-clients/open-api/purposeTemplateApi.yml",
    collection: "collections/purpose-template",
  },
  {
    name: "tenant",
    spec: "packages/api-clients/open-api/tenantApi.yml",
    collection: "collections/tenant",
  },
].freeze

def read_yaml(relative_path)
  YAML.safe_load(
    ROOT.join(relative_path).read,
    permitted_classes: [Date, Time, Symbol],
    aliases: true
  )
end

def normalize_openapi_path(path)
  path.gsub(/\{([^}]+)\}/, ':\1')
end

def normalize_bru_url(url)
  return nil if url.nil?

  path = url.strip
  path = path.sub(%r{\A\{\{.*?\}\}}, "")
  path = path.sub(%r{\Ahttps?://[^/]+}, "")
  path = "/#{path}" unless path.start_with?("/")
  path = path.split("?").first
  path
end

def route_signature(path)
  return nil if path.nil?

  path.gsub(%r{/\{\{.*?\}\}}, "/:param")
      .gsub(%r{/\{.*?\}}, "/:param")
      .gsub(%r{/:[^/]+}, "/:param")
end

def extract_block(content, block_name)
  match = content.match(/^#{Regexp.escape(block_name)}\s*\{\n(.*?)^}\n?/m)
  match&.captures&.first
end

def parse_bru_headers(content)
  block = extract_block(content, "headers")
  return {} if block.nil?

  block.each_line.each_with_object({}) do |line, acc|
    stripped = line.strip
    next if stripped.empty?

    key, value = stripped.split(":", 2)
    next if key.nil? || value.nil?

    acc[key.strip.downcase] = value.strip
  end
end

def sanitize_json_body(body)
  result = +""
  inside_string = false
  escaped = false
  index = 0

  while index < body.length
    char = body[index]

    if inside_string
      result << char
      if escaped
        escaped = false
      elsif char == "\\"
        escaped = true
      elsif char == "\""
        inside_string = false
      end
      index += 1
      next
    end

    if char == "\""
      inside_string = true
      result << char
      index += 1
      next
    end

    if body[index, 2] == "{{"
      close_index = body.index("}}", index)
      break if close_index.nil?

      result << "\"#{PLACEHOLDER_TOKEN}\""
      index = close_index + 2
      next
    end

    result << char
    index += 1
  end

  result
end

def parse_bru_request(file_path)
  content = file_path.read
  return nil if file_path.basename.to_s == "folder.bru"

  method = HTTP_METHODS.find { |candidate| content.match?(/^#{candidate}\s*\{/i) }
  return nil if method.nil?

  method_block = extract_block(content, method)
  return nil if method_block.nil?

  url = method_block[/^\s*url:\s*(.+)$/, 1]
  body_type = method_block[/^\s*body:\s*(.+)$/, 1]&.strip
  body_block = extract_block(content, "body:json")

  {
    file: file_path.relative_path_from(ROOT).to_s,
    method: method.upcase,
    path: normalize_bru_url(url),
    body_type: body_type,
    headers: parse_bru_headers(content),
    body_text: body_block,
  }
end

def json_pointer(root, pointer)
  pointer.delete_prefix("#/").split("/").reduce(root) do |current, token|
    current.fetch(token.gsub("~1", "/").gsub("~0", "~"))
  end
end

def resolve_schema(schema, root, seen = [])
  return {} if schema.nil?
  return schema unless schema.is_a?(Hash)

  if schema.key?("$ref")
    ref = schema.fetch("$ref")
    raise "External refs are not supported: #{ref}" unless ref.start_with?("#/")
    raise "Circular ref detected: #{ref}" if seen.include?(ref)

    resolved = json_pointer(root, ref)
    merged = resolve_schema(resolved, root, seen + [ref]).merge(
      schema.reject { |key, _value| key == "$ref" }
    )
    return merged
  end

  schema
end

def combine_object_schemas(schemas, root)
  combined = {}
  schemas.each do |schema|
    resolved = normalize_schema(resolve_schema(schema, root), root)
    combined["type"] ||= resolved["type"]
    combined["nullable"] ||= resolved["nullable"]
    combined["required"] = Array(combined["required"]) | Array(resolved["required"])
    combined["properties"] = (combined["properties"] || {}).merge(resolved["properties"] || {})
    combined["items"] = resolved["items"] if resolved.key?("items")
    if resolved.key?("additionalProperties")
      combined["additionalProperties"] = resolved["additionalProperties"]
    end
  end
  combined
end

def normalize_schema(schema, root)
  resolved = resolve_schema(schema, root)
  return {} unless resolved.is_a?(Hash)

  if resolved.key?("allOf")
    merged = combine_object_schemas(resolved.fetch("allOf"), root)
    merged.merge!(resolved.reject { |key, _value| key == "allOf" })
    return merged
  end

  resolved
end

def placeholder_value?(value)
  value == PLACEHOLDER_TOKEN
end

def validate_against_variants(value, variants, root, path)
  validations = variants.map do |variant|
    validate_value(value, variant, root, path)
  end

  validations.min_by(&:length) || []
end

def validate_object(value, schema, root, path)
  issues = []

  unless value.is_a?(Hash)
    return ["#{path}: expected object, found #{value.class}"]
  end

  properties = schema.fetch("properties", {})
  required = Array(schema["required"])

  required.each do |property|
    issues << "#{path}.#{property}: missing required property" unless value.key?(property)
  end

  value.each do |property, property_value|
    property_path = "#{path}.#{property}"
    if properties.key?(property)
      issues.concat(
        validate_value(property_value, properties.fetch(property), root, property_path)
      )
    elsif schema["additionalProperties"] == false
      issues << "#{property_path}: property not allowed"
    elsif schema["additionalProperties"].is_a?(Hash)
      issues.concat(
        validate_value(property_value, schema["additionalProperties"], root, property_path)
      )
    end
  end

  issues
end

def validate_array(value, schema, root, path)
  return ["#{path}: expected array, found #{value.class}"] unless value.is_a?(Array)

  item_schema = schema["items"]
  return [] if item_schema.nil?

  value.flat_map.with_index do |item, index|
    validate_value(item, item_schema, root, "#{path}[#{index}]")
  end
end

def validate_primitive(value, schema, path)
  return [] if placeholder_value?(value)

  type = schema["type"]
  case type
  when "string"
    issues = []
    issues << "#{path}: expected string, found #{value.class}" unless value.is_a?(String)
    if schema["enum"].is_a?(Array) && !schema["enum"].include?(value)
      issues << "#{path}: value #{value.inspect} is not in enum #{schema['enum'].inspect}"
    end
    issues
  when "integer"
    ["#{path}: expected integer, found #{value.class}"].reject do
      value.is_a?(Integer)
    end
  when "number"
    ["#{path}: expected number, found #{value.class}"].reject do
      value.is_a?(Numeric)
    end
  when "boolean"
    ["#{path}: expected boolean, found #{value.class}"].reject do
      value == true || value == false
    end
  else
    []
  end
end

def validate_value(value, schema, root, path = "$")
  normalized = normalize_schema(schema, root)
  return [] if normalized.empty?
  return [] if normalized["nullable"] && value.nil?

  if normalized["oneOf"].is_a?(Array)
    return validate_against_variants(value, normalized["oneOf"], root, path)
  end

  if normalized["anyOf"].is_a?(Array)
    return validate_against_variants(value, normalized["anyOf"], root, path)
  end

  type = normalized["type"]
  type = "object" if type.nil? && normalized.key?("properties")
  type = "array" if type.nil? && normalized.key?("items")

  case type
  when "object"
    validate_object(value, normalized, root, path)
  when "array"
    validate_array(value, normalized, root, path)
  else
    validate_primitive(value, normalized, path)
  end
end

def request_body_for(operation, openapi_root, request)
  request_body = operation["requestBody"]
  return nil if request_body.nil?

  content = normalize_schema(request_body, openapi_root)["content"] || request_body["content"] || {}
  content_type = request[:headers]["content-type"]&.split(";")&.first
  return [content_type, content.fetch(content_type)] if content_type && content.key?(content_type)

  json_like = content.find { |media_type, _| media_type.include?("json") }
  return json_like if json_like

  content.first
end

def compare_request(operation:, openapi_root:, request:)
  issues = []
  request_body = operation["requestBody"]
  has_body =
    if request[:body_type] == "json"
      !request[:body_text].nil? && !request[:body_text].strip.empty?
    else
      !request[:body_type].nil? && request[:body_type] != "none"
    end

  if request_body.nil?
    if has_body
      issues << "Bruno sends a body but the OpenAPI operation has no requestBody"
    end
    return issues
  end

  resolved_request_body = normalize_schema(request_body, openapi_root)
  if resolved_request_body["required"] && !has_body
    issues << "Bruno request body missing but OpenAPI marks it as required"
    return issues
  end

  return issues unless has_body

  media_type, media_definition = request_body_for(operation, openapi_root, request)
  if media_definition.nil?
    issues << "No compatible content type found in OpenAPI for Bruno body"
    return issues
  end

  unless media_type.to_s.include?("json")
    issues << "Validation skipped: OpenAPI expects #{media_type}, Bruno body type is #{request[:body_type]}"
    return issues
  end

  if request[:body_text].nil?
    issues << "Bruno request declares a JSON body but body:json block is missing"
    return issues
  end

  begin
    body = JSON.parse(sanitize_json_body(request[:body_text]))
  rescue JSON::ParserError => e
    issues << "Bruno JSON body cannot be parsed: #{e.message}"
    return issues
  end

  schema = media_definition["schema"]
  if schema.nil?
    issues << "OpenAPI requestBody for #{media_type} has no schema"
    return issues
  end

  issues.concat(validate_value(body, schema, openapi_root))
end

def load_collection_requests(collection_path)
  ROOT.join(collection_path)
      .glob("**/*.bru")
      .map { |file| parse_bru_request(file) }
      .compact
end

def build_openapi_operations(spec_path)
  root = read_yaml(spec_path)
  operations = root.fetch("paths", {}).flat_map do |path, path_item|
    HTTP_METHODS.map do |method|
      operation = path_item[method]
      next if operation.nil?

      {
        key: "#{method.upcase} #{normalize_openapi_path(path)}",
        method: method.upcase,
        path: normalize_openapi_path(path),
        operation: operation,
        root: root,
      }
    end.compact
  end

  [root, operations]
end

def print_service_report(service, missing_routes, stale_routes, body_mismatches, matched_count, total_count)
  puts "## #{service[:name]}"
  puts "OpenAPI routes: #{total_count}"
  puts "Matched Bruno routes: #{matched_count}"
  puts "Missing in Bruno: #{missing_routes.length}"
  puts "Bruno routes not in OpenAPI: #{stale_routes.length}"
  puts "Payload mismatches: #{body_mismatches.length}"

  unless missing_routes.empty?
    puts
    puts "Missing routes:"
    missing_routes.each do |route|
      puts "- #{route[:method]} #{route[:path]}"
    end
  end

  unless stale_routes.empty?
    puts
    puts "Bruno-only routes:"
    stale_routes.each do |request|
      puts "- #{request[:method]} #{request[:path]} (#{request[:file]})"
    end
  end

  unless body_mismatches.empty?
    puts
    puts "Payload mismatches:"
    body_mismatches.each do |mismatch|
      puts "- #{mismatch[:method]} #{mismatch[:path]} (#{mismatch[:file]})"
      mismatch[:issues].each do |issue|
        puts "  - #{issue}"
      end
    end
  end

  puts
end

PROCESS_SPECS.each do |service|
  _root, operations = build_openapi_operations(service.fetch(:spec))
  requests = load_collection_requests(service.fetch(:collection))

  requests_by_key = requests.group_by do |request|
    "#{request[:method]} #{route_signature(request[:path])}"
  end
  operation_keys = operations.map do |operation|
    "#{operation[:method]} #{route_signature(operation[:path])}"
  end

  missing_routes = operations.reject do |operation|
    requests_by_key.key?("#{operation[:method]} #{route_signature(operation[:path])}")
  end
  matched_operations = operations.select do |operation|
    requests_by_key.key?("#{operation[:method]} #{route_signature(operation[:path])}")
  end
  stale_routes = requests.reject do |request|
    operation_keys.include?("#{request[:method]} #{route_signature(request[:path])}")
  end

  body_mismatches = matched_operations.flat_map do |operation|
    request_key = "#{operation[:method]} #{route_signature(operation[:path])}"
    requests_by_key.fetch(request_key, []).map do |request|
      issues = compare_request(
        operation: operation[:operation],
        openapi_root: operation[:root],
        request: request
      )
      next if issues.empty?

      {
        method: request[:method],
        path: request[:path],
        file: request[:file],
        issues: issues,
      }
    end.compact
  end

  print_service_report(
    service,
    missing_routes,
    stale_routes,
    body_mismatches,
    matched_operations.length,
    operations.length
  )
end
