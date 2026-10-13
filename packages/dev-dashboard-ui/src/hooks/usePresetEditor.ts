import type {
  Package,
  Preset,
  PresetInput,
} from "pagopa-interop-dev-dashboard-contracts";

import { useRef, useState } from "react";

export function usePresetEditor() {
  const [value, setValue] = useState<{ preset?: Preset }>();
  const trigger = useRef<HTMLButtonElement>();
  function open(preset: Preset | undefined, button: HTMLButtonElement) {
    trigger.current = button;
    setValue({ preset });
  }
  function close() {
    setValue(undefined);
  }
  function restoreFocus() {
    trigger.current?.focus();
  }
  return { value, open, close, restoreFocus };
}

export function usePresetDraft({
  preset,
  packages,
  busy,
  onSave,
  onCancel,
}: {
  preset?: Preset;
  packages: Package[];
  busy: boolean;
  onSave: (input: PresetInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(preset?.name ?? "");
  const [members, setMembers] = useState(preset?.packages ?? []);
  const [search, setSearch] = useState("");
  const submitting = useRef(false);
  const query = search.trim().toLowerCase();
  const visiblePackages = packages.filter(
    (item) =>
      item.name.toLowerCase().includes(query) ||
      item.label.toLowerCase().includes(query)
  );
  function includePackage(name: string, checked: boolean) {
    setMembers((previous) =>
      checked
        ? [...previous, { name, watch: false }]
        : previous.filter((member) => member.name !== name)
    );
  }
  function changeWatch(name: string, checked: boolean) {
    setMembers((previous) =>
      previous.map((member) =>
        member.name === name ? { ...member, watch: checked } : member
      )
    );
  }
  async function save() {
    if (submitting.current || busy || !name.trim() || !members.length) return;
    submitting.current = true;
    try {
      if (
        await onSave({
          ...(preset ? { id: preset.id } : {}),
          name: name.trim(),
          packages: members,
          seed: false,
        })
      )
        onCancel();
    } finally {
      submitting.current = false;
    }
  }
  return {
    name,
    setName,
    members,
    search,
    setSearch,
    visiblePackages,
    includePackage,
    changeWatch,
    save,
  };
}
