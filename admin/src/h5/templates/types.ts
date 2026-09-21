export type TemplateMapping = { map_key: string; map_value: string };

export type TemplateMeta = {
  module: string;
  title: string;
  site_title?: string;
  form_title?: string;
};

export type TemplateProps = {
  template: TemplateMeta;
  mappings: TemplateMapping[];
  values: Record<string, string>;
  submitting: boolean;
  message: string;
  onValueChange: (key: string, value: string) => void;
  onSubmit: () => void;
};
