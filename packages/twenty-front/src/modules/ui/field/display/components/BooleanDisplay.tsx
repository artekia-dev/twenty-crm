import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Tag } from 'twenty-ui/data-display';
import { IconCheck, IconX } from 'twenty-ui/icon';

type BooleanDisplayProps = {
  value: boolean | null | undefined;
};

const StyledContainer = styled.div`
  align-items: center;
  display: flex;
  height: 20px;
`;

// Green for true, red for false, so the state reads at a glance down a column
// instead of word by word.
//
// It uses the shared Tag, the same component every other coloured field uses,
// rather than a colour of its own. A second way of drawing the same idea is how
// an interface ends up looking assembled by different people.
//
// This belongs in the display component, not the input: the input is only
// rendered while a cell is hovered or edited, so colouring there left every
// resting row plain and made the colour appear to follow the mouse.
export const BooleanDisplay = ({ value }: BooleanDisplayProps) => {
  if (value === null || value === undefined) {
    return <StyledContainer />;
  }

  const isTrue = value === true;

  return (
    <StyledContainer>
      <Tag
        color={isTrue ? 'green' : 'red'}
        text={isTrue ? t`True` : t`False`}
        Icon={isTrue ? IconCheck : IconX}
      />
    </StyledContainer>
  );
};
