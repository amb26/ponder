
/* description: Adapted from Orderly Normative Grammar */


/* author: Zach Carter */

%lex
digit                       [0-9]
esc                         "\\"
int                         "-"?(?:[0-9]|[1-9][0-9]+)
exp                         (?:[eE][-+]?[0-9]+)
frac                        (?:\.[0-9]+)

%%
\s+                                                          /* skip whitespace */
\/\/[^\n]*                                                   /* skip comment */
\#[^\n]*                                                     /* skip comment */
";"                                                          return ';'
","                                                          return ','
"{"                                                          return '{'
"}"                                                          return '}'
"["                                                          return '['
"]"                                                          return ']'
"`"                                                          return '`'
"<"                                                          return '<'
">"                                                          return '>'
":"                                                          return ':'
("FORWARD"|"forward")                                        return 'FORWARD'
\"(?:{esc}["bfnrt/{esc}]|{esc}"u"[a-fA-F0-9]{4}|[^"{esc}])*\"  yytext = yytext.substr(1,yyleng-2); return 'STRING_LIT';
{int}{frac}?{exp}?\b                                         return 'NUMBER_LIT';
[A-Za-z_0-9-]+                                               return 'PROPERTY';
"?"                                                          return '?'
"*"                                                          return '*'
"="                                                          return '='
\/(?:[^\/]|"\\/")*\/                                         return 'REGEX';
<<EOF>>                                                      return 'EOF';

/lex

%%

file
    : orderly_schema EOF
        {return $1;}
    ;

orderly_schema
    : unnamed_entry ';'
    | unnamed_entry
    ;

/*
named_entries
    : named_entry ';' named_entries
        {$$ = $3; $$.unshift($1);}
    | named_entry
        {$$ = [$1];}
    | 
        {$$ = [];}
    ;

unnamed_entries
    : unnamed_entry ';' unnamed_entries
        {$$ = $3; $3.unshift($1);}
    | unnamed_entry
        {$$ = [$1];}
    | 
        {$$ = [];}
    ;

named_entry
    : property_name definition_suffix
        {$$ = [$2, $1]; yy.Type.addOptionals($1, $3);}
    | string_prefix property_name string_suffix
        {$$ = [$2, $1]; yy.Type.addOptionals($1, $3);}
    ;
*/

unnamed_entry
    : definition_suffix
        {$$ = $1; yy.Type.addOptionals($$, $2);}
    | string_prefix string_suffix
        {$$ = $1; yy.Type.addOptionals($$, $2);}
    ;

string_prefix
    : optional_range
        {$$ = new yy.Type('string', $2);}
    ;

string_suffix
    : optional_perl_regex definition_suffix
        {$$ = $2; $$.pattern = $1;}
    ;

definition_suffix
    : optional_enum_values optional_default_value optional_requires optional_optional_marker optional_extra_properties
        {$$ = {'enums': $1, 'defaultv': $2, 'requires': $3, 'optional': $4, 'extras': $5};}
    ;

csv_property_names
    : csv_property_names ',' property_name
        {$$ = $1; $$.push($3);}
    | property_name
        {$$ = [$1];}
    ;

optional_extra_properties
    : '`' JSONObject '`'
        {$$ = $2;}
    | 
        {$$ = null;}
    ;

optional_requires
    : '<' csv_property_names '>'
        {$$ = $2;}
    | 
        {$$ = null;}
    ;

optional_enum_values
    : JSONArray
    | 
        {$$ = null;}
    ;

optional_default_value
    : '=' JSONValue
        {$$ = $2;}
    | 
        {$$ = yy.NOVALUE;}
    ;

optional_range
    : '{' JSONNumber ',' JSONNumber '}'
        {$$ = [$2, $4];}
    | '{' JSONNumber ',' '}'
        {$$ = [$2, null];}
    | '{' ',' JSONNumber '}'
        {$$ = [null, $3];}
    | '{' ',' '}'
        {$$ = null;}
    | 
        {$$ = null;}
    ;

property_name
    : JSONString
    | PROPERTY
        {$$ = yytext;}
    ;

optional_perl_regex
    : REGEX
        {$$ = yytext.substr(1, yytext.length-2);}
    | 
        {$$ = null;}
    ;

JSONString
    : STRING_LIT
        {$$ = yytext;}
    ;

JSONNumber
    : NUMBER_LIT
        {$$ = Number(yytext);}
    ;


JSONText
    : JSONValue
    ;

JSONValue
    : JSONNullLiteral
    | JSONBooleanLiteral
    | JSONString
    | JSONNumber
    | JSONObject
    | JSONArray
    ;

JSONObject
    : '{' '}'
        {$$ = {};}
    | '{' JSONMemberList '}'
        {$$ = $2;}
    ;

JSONMember
    : JSONString ':' JSONValue
        {$$ = [$1, $3];}
    ;

JSONMemberList
    : JSONMember
        {$$ = {}; $$[$1[0]] = $1[1];}
    | JSONMemberList ',' JSONMember
        {$$ = $1; $1[$3[0]] = $3[1];}
    ;

JSONArray
    : '[' ']'
        {$$ = [];}
    | '[' JSONElementList ']'
        {$$ = $2;}
    ;

JSONElementList
    : JSONValue
        {$$ = [$1];}
    | JSONElementList ',' JSONValue
        {$$ = $1; $1.push($3);}
    ;

