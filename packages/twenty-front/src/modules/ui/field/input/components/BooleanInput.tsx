import { styled } from '@linaria/react';
import { useEffect, useId, useState } from 'react';

import { BooleanDisplay } from '@/ui/field/display/components/BooleanDisplay';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { t } from '@lingui/core/macro';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledEditableBooleanFieldContainer = styled.div<{ readonly?: boolean }>`
  align-items: center;
  color: ${({ readonly }) =>
    readonly
      ? themeCssVariables.font.color.tertiary
      : themeCssVariables.font.color.primary};
  cursor: ${({ onClick }) => (onClick ? 'pointer' : 'default')};

  display: flex;
  height: 100%;

  width: 100%;
`;

type BooleanInputProps = {
  value: boolean;
  onToggle?: (newValue: boolean) => void;
  readonly?: boolean;
  testId?: string;
};

// A boolean field flips on a single click, with nothing between the click and
// the saved change. Fine for a checkbox on a form, wrong for a record: brushing
// past one while scrolling a table rewrites data silently, and nothing on
// screen says it happened.
//
// So the click asks first. This is the only place a boolean is toggled by
// clicking, which is why the confirmation belongs here and not in each field
// that happens to matter. A per-field list would be one omission away from the
// exact accident it is meant to prevent.
export const BooleanInput = ({
  value,
  onToggle,
  readonly,
  testId,
}: BooleanInputProps) => {
  const [internalValue, setInternalValue] = useState(value);
  const { openModal } = useModal();

  // Every rendered boolean gets its own modal instance. Sharing one would let a
  // confirmation opened on one row answer for another.
  const modalInstanceId = `boolean-input-confirmation-${useId()}`;

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleConfirm = () => {
    setInternalValue(!internalValue);
    onToggle?.(!internalValue);
  };

  return (
    <>
      <StyledEditableBooleanFieldContainer
        onClick={readonly ? undefined : () => openModal(modalInstanceId)}
        readonly={readonly}
        data-testid={testId}
      >
        <BooleanDisplay value={internalValue} />
      </StyledEditableBooleanFieldContainer>
      <ConfirmationModal
        modalInstanceId={modalInstanceId}
        title={internalValue ? t`Change to No?` : t`Change to Yes?`}
        subtitle={
          internalValue
            ? t`This is currently Yes and will be saved as No.`
            : t`This is currently No and will be saved as Yes.`
        }
        onConfirmClick={handleConfirm}
        confirmButtonText={t`Change`}
      />
    </>
  );
};
