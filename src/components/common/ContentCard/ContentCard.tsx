import React from 'react'
import { NavLink } from 'react-router-dom'
import { ConditionalWrap, noop } from '../helpers/Helpers'
import { CardContentDirection, CardLinkIconPlacement, ContentCardProps } from './ContentCard.types'
import './ContentCard.scss'

/**
 * Note: This component is created to be used at some places for a specific use case where a clickable card is required
 * which contains an image, a card title & an internal link. So it can be updated further according to an use case.
 */
export default function ContentCard({
    redirectTo,
    rootClassName,
    isExternalRedirect,
    direction,
    onClick,
    imgSrc,
    title,
    linkText,
    LinkIcon,
    linkIconClass,
    linkIconPlacement,
}: ContentCardProps) {
    const getContent = () => {
        return (
            <>
                <img className="content-card-img dc__top-radius-4" src={imgSrc} alt={title} />
                <ConditionalWrap
                    condition={direction === CardContentDirection.Horizontal}
                    wrap={(children) => <div className="flex column left">{children}</div>}
                >
                    <>
                        <div
                            className={`fw-6 fs-16 cn-9 ${
                                direction === CardContentDirection.Horizontal ? '' : 'pt-24'
                            } pb-12 pl-24 pr-24 dc__break-word`}
                        >
                            {title}
                        </div>
                        <div
                            className={`flex ${
                                linkIconPlacement === CardLinkIconPlacement.AfterLinkApart ||
                                linkIconPlacement === CardLinkIconPlacement.BeforeLinkApart
                                    ? 'dc__content-space'
                                    : 'left'
                            } w-100 ${direction === CardContentDirection.Horizontal ? '' : 'pb-24'} pl-24 pr-24`}
                        >
                            {LinkIcon &&
                                (linkIconPlacement === CardLinkIconPlacement.BeforeLink ||
                                    linkIconPlacement === CardLinkIconPlacement.BeforeLinkApart) && (
                                    <LinkIcon className={`icon-dim-20 ${linkIconClass || ''}`} />
                                )}
                            <span className="fs-14 fw-6 lh-20 cb-5">{linkText}</span>
                            {LinkIcon &&
                                (linkIconPlacement === CardLinkIconPlacement.AfterLink ||
                                    linkIconPlacement === CardLinkIconPlacement.AfterLinkApart) && (
                                    <LinkIcon className={`icon-dim-20 ${linkIconClass || ''}`} />
                                )}
                        </div>
                    </>
                </ConditionalWrap>
            </>
        )
    }
    return (
        <div className={`content-card-container bcn-0 br-4 en-2 bw-1 cursor ${rootClassName || ''}`}>
            {isExternalRedirect ? (
                <a
                    href={redirectTo}
                    className={`dc__no-decor fw-6 cursor cn-9 ${direction || CardContentDirection.Vertical}`}
                    onClick={onClick || noop}
                    rel="noreferrer noopener"
                    target="_blank"
                >
                    {getContent()}
                </a>
            ) : (
                <NavLink
                    to={redirectTo}
                    className={`dc__no-decor fw-6 cursor cn-9 ${direction || CardContentDirection.Vertical}`}
                    activeClassName="active"
                    onClick={onClick || noop}
                >
                    {getContent()}
                </NavLink>
            )}
        </div>
    )
}
